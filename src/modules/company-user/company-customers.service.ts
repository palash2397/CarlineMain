import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';

import { User, UserDocument } from '../user/schema/user.schema';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserDocument,
} from './schema/company-user.schema';
import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { Customer, CustomerDocument } from '../customer/schema/customer.schema';

import { MailService } from '../mail/mail.service';

import {
  GetCompanyCustomersQueryDto,
  CompanyCustomerStatusFilter,
} from './dto/get-company-customers-query.dto';
import { CreateCompanyCustomerDto } from './dto/create-company-customer.dto';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { UserRole } from 'src/common/enums/user/role.enum';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

@Injectable()
export class CompanyCustomersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    private readonly mailService: MailService,
  ) {}

  private formatDisplayDate(dateInput: any): string {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  // ==========================================
  // Helper: Resolve Company Context for User
  // ==========================================
  private async resolveCompanyContext(
    queryCompanyId?: string,
    user?: any,
  ): Promise<{
    company: any | null;
    companyIds: string[];
    isGlobalAdmin: boolean;
  }> {
    const userRoles = Array.isArray(user?.roles)
      ? user.roles
      : [user?.roles || user?.role];
    const isGlobalAdmin =
      userRoles.includes(UserRole.SUPERADMIN) ||
      userRoles.includes(UserRole.ADMIN) ||
      userRoles.includes('SUPERADMIN') ||
      userRoles.includes('ADMIN');

    if (queryCompanyId) {
      let company: any = null;
      if (isValidObjectId(queryCompanyId)) {
        company = await this.companyModel.findById(queryCompanyId).lean();
      }
      if (!company) {
        company = await this.companyModel
          .findOne({
            $or: [
              { companyId: queryCompanyId },
              { companyCode: queryCompanyId.toUpperCase() },
            ],
          })
          .lean();
      }
      if (company) {
        return {
          company,
          companyIds: [company._id.toString(), company.companyId].filter(
            Boolean,
          ),
          isGlobalAdmin: false,
        };
      } else if (isGlobalAdmin) {
        return {
          company: null,
          companyIds: [queryCompanyId],
          isGlobalAdmin: false,
        };
      }
    }

    if (isGlobalAdmin && !queryCompanyId) {
      return { company: null, companyIds: [], isGlobalAdmin: true };
    }

    let company: any = null;
    const userId = user?.id || user?._id || user?.userId;

    if (user?.companyId) {
      if (isValidObjectId(user.companyId)) {
        company = await this.companyModel.findById(user.companyId).lean();
      }
      if (!company) {
        company = await this.companyModel
          .findOne({ companyId: user.companyId })
          .lean();
      }
    }

    if (!company && userId && isValidObjectId(userId)) {
      const compUser = await this.companyUserModel.findById(userId).lean();
      if (compUser?.companyId) {
        company = await this.companyModel
          .findOne({
            $or: [
              ...(isValidObjectId(compUser.companyId)
                ? [{ _id: compUser.companyId }]
                : []),
              { companyId: compUser.companyId },
            ],
          })
          .lean();
      }

      if (!company) {
        const u = await this.userModel.findById(userId).lean();
        if (u && (u as any).companyId) {
          company = await this.companyModel
            .findOne({
              $or: [
                ...(isValidObjectId((u as any).companyId)
                  ? [{ _id: (u as any).companyId }]
                  : []),
                { companyId: (u as any).companyId },
              ],
            })
            .lean();
        }
      }
    }

    const companyIds = company
      ? [company._id.toString(), company.companyId].filter(Boolean)
      : [];

    return { company, companyIds, isGlobalAdmin: false };
  }

  // ==========================================
  // ==========================================
  // 1. Get All Company Customers (Original API - Untouched)
  // ==========================================
  async getCompanyCustomers(query: GetCompanyCustomersQueryDto, user: any) {
    try {
      const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
      const limit = Math.max(1, parseInt(query.limit || '10', 10) || 10);
      const skip = (page - 1) * limit;

      const { company, companyIds, isGlobalAdmin } =
        await this.resolveCompanyContext(query.companyId, user);

      if (!isGlobalAdmin && companyIds.length === 0) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      // 1. Build Ride Match Condition for Company
      const rideMatch: any = {
        user: { $ne: null },
      };
      if (!isGlobalAdmin) {
        rideMatch.companyId = { $in: companyIds };
      }

      // 2. Aggregate Company Customers from Ride History
      const customerAggregations = await this.rideModel.aggregate([
        { $match: rideMatch },
        {
          $group: {
            _id: '$user',
            totalTrips: { $sum: 1 },
            completedTrips: {
              $sum: {
                $cond: [{ $eq: ['$status', RideStatus.RIDE_COMPLETED] }, 1, 0],
              },
            },
            cancelledTrips: {
              $sum: {
                $cond: [{ $eq: ['$status', RideStatus.RIDE_CANCELLED] }, 1, 0],
              },
            },
            totalSpent: {
              $sum: {
                $cond: [
                  { $eq: ['$status', RideStatus.RIDE_COMPLETED] },
                  { $ifNull: ['$payableFare', { $ifNull: ['$totalFare', 0] }] },
                  0,
                ],
              },
            },
            lastTripAt: { $max: '$createdAt' },
            latestRideId: { $last: '$_id' },
          },
        },
      ]);

      if (!customerAggregations || customerAggregations.length === 0) {
        return new ApiResponse(
          200,
          {
            customers: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
            company: company
              ? { id: company._id, name: company.displayName || company.legalName, code: company.companyId }
              : null,
            counts: { all: 0, active: 0, restricted: 0, inactive: 0 },
          },
          'Company customers fetched successfully',
        );
      }

      // 3. Fetch User Profiles for these Customer IDs
      const rawUserIds = customerAggregations.map((c) => c._id).filter(Boolean);
      const objectIds = rawUserIds.filter((id) => isValidObjectId(id)).map((id) => new Types.ObjectId(id));
      const stringIds = rawUserIds.map((id) => id.toString());

      const userQuery: any = {
        $or: [{ _id: { $in: objectIds } }, { _id: { $in: stringIds } }],
      };

      const users = await this.userModel
        .find(userQuery)
        .select('firstName lastName phoneNumber email avatar isActive createdAt')
        .lean();

      const userMap = new Map<string, any>();
      users.forEach((u: any) => {
        userMap.set(u._id.toString(), u);
      });

      const customerDocs = await this.customerModel
        .find({
          $or: [
            { _id: { $in: objectIds } },
            { mobileNumber: { $in: users.map((u) => u.phoneNumber).filter(Boolean) } },
          ],
        })
        .lean();

      const legacyCustomerMap = new Map<string, any>();
      customerDocs.forEach((c: any) => {
        legacyCustomerMap.set(c._id.toString(), c);
        if (c.mobileNumber) legacyCustomerMap.set(c.mobileNumber, c);
      });

      const latestRideIds = customerAggregations.map((c) => c.latestRideId).filter(Boolean);
      const latestRides = await this.rideModel
        .find({ _id: { $in: latestRideIds } })
        .select('pickup dropoff driver payableFare totalFare status createdAt')
        .lean();

      const latestRideMap = new Map<string, any>();
      latestRides.forEach((r: any) => {
        latestRideMap.set(r._id.toString(), r);
      });

      let combinedCustomers = customerAggregations.map((agg) => {
        const uId = agg._id?.toString();
        const userDoc = userMap.get(uId);
        const legacyDoc =
          legacyCustomerMap.get(uId) ||
          (userDoc?.phoneNumber ? legacyCustomerMap.get(userDoc.phoneNumber) : null);

        const fullName =
          userDoc?.firstName || userDoc?.lastName
            ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim()
            : legacyDoc?.fullName || 'Customer';

        const phone = userDoc?.phoneNumber || legacyDoc?.mobileNumber || '-';
        const email = userDoc?.email || legacyDoc?.email || '-';
        const avatar = userDoc?.avatar || null;
        const isActive = userDoc ? userDoc.isActive !== false && !(userDoc as any).isBlocked : true;
        const latestRide = agg.latestRideId ? latestRideMap.get(agg.latestRideId.toString()) : null;

        const lastTripDate = latestRide?.createdAt || agg.lastTripAt;
        const formattedLastTrip = this.formatDisplayDate(lastTripDate);
        const statusLabel = isActive ? 'Active' : 'Restricted';

        return {
          _id: uId,
          customerId: uId,
          customer: fullName,
          name: fullName,
          phone: phone,
          phoneNumber: phone,
          email: email,
          avatar: avatar,
          trips: agg.totalTrips || 0,
          totalTrips: agg.totalTrips || 0,
          completedTrips: agg.completedTrips || 0,
          cancelledTrips: agg.cancelledTrips || 0,
          totalSpent: Number((agg.totalSpent || 0).toFixed(2)),
          currency: '₹',
          lastTrip: formattedLastTrip,
          lastTripDate: lastTripDate || null,
          lastTripDetails: latestRide
            ? {
                rideId: latestRide._id,
                date: latestRide.createdAt,
                status: latestRide.status,
                pickup: latestRide.pickup?.address || 'Pickup Point',
                dropoff: latestRide.dropoff?.address || 'Dropoff Point',
                fare: latestRide.payableFare || latestRide.totalFare || 0,
              }
            : null,
          status: statusLabel,
          statusBadge: {
            label: statusLabel,
            color: isActive ? 'green' : 'red',
            icon: isActive ? 'check-circle' : 'x-circle',
          },
          action: 'View More',
          joinedAt: userDoc?.createdAt || legacyDoc?.createdAt || agg.lastTripAt,
        };
      });

      if (query.search && query.search.trim()) {
        const term = query.search.toLowerCase().trim();
        combinedCustomers = combinedCustomers.filter(
          (c) =>
            c.customer.toLowerCase().includes(term) ||
            c.phoneNumber.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term),
        );
      }

      if (query.status && query.status !== CompanyCustomerStatusFilter.ALL) {
        const filterStatus = String(query.status).toLowerCase();
        combinedCustomers = combinedCustomers.filter(
          (c) =>
            c.status.toLowerCase() === filterStatus ||
            (filterStatus === 'inactive' && c.status === 'Restricted'),
        );
      }

      combinedCustomers.sort((a, b) => {
        const timeA = a.lastTripDate ? new Date(a.lastTripDate).getTime() : 0;
        const timeB = b.lastTripDate ? new Date(b.lastTripDate).getTime() : 0;
        return timeB - timeA;
      });

      const total = combinedCustomers.length;
      const paginatedCustomers = combinedCustomers.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit) || 1;

      return new ApiResponse(
        200,
        {
          customers: paginatedCustomers,
          pagination: { total, page, limit, totalPages },
          company: company
            ? { id: company._id, name: company.displayName || company.legalName, code: company.companyId }
            : null,
          counts: {
            all: combinedCustomers.length,
            active: combinedCustomers.filter((c) => c.status === 'Active').length,
            restricted: combinedCustomers.filter((c) => c.status === 'Restricted').length,
            inactive: combinedCustomers.filter((c) => c.status === 'Restricted').length,
          },
        },
        'Company customers fetched successfully',
      );
    } catch (error: any) {
      console.error('Error while fetching company customers:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // 1b. NEW API: Get Customers Belonging Strictly to Same Company ID
  // ==========================================
  async getSameCompanyCustomers(query: GetCompanyCustomersQueryDto, user: any) {
    try {
      const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
      const limit = Math.max(1, parseInt(query.limit || '10', 10) || 10);
      const skip = (page - 1) * limit;

      const { company, companyIds, isGlobalAdmin } =
        await this.resolveCompanyContext(query.companyId, user);

      if (!isGlobalAdmin && companyIds.length === 0) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const userFilter: any = {};
      if (!isGlobalAdmin || query.companyId) {
        if (companyIds.length > 0) {
          userFilter.companyId = { $in: companyIds };
        } else if (query.companyId) {
          userFilter.companyId = query.companyId;
        }
      }

      const companyUsers = await this.userModel
        .find(userFilter)
        .select('firstName lastName phoneNumber email avatar isActive companyId createdAt')
        .lean();

      if (!companyUsers || companyUsers.length === 0) {
        return new ApiResponse(
          200,
          {
            customers: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
            company: company
              ? { id: company._id, name: company.displayName || company.legalName, code: company.companyId }
              : null,
            counts: { all: 0, active: 0, restricted: 0, inactive: 0 },
          },
          'Company customers fetched successfully',
        );
      }

      const userObjectIds = companyUsers
        .map((u) => u._id)
        .filter((id) => isValidObjectId(id))
        .map((id) => new Types.ObjectId(id));
      const userStringIds = companyUsers.map((u) => u._id.toString());

      const rideMatch: any = {
        user: { $in: [...userObjectIds, ...userStringIds] },
      };
      if (!isGlobalAdmin && companyIds.length > 0) {
        rideMatch.companyId = { $in: companyIds };
      }

      const customerAggregations = await this.rideModel.aggregate([
        { $match: rideMatch },
        {
          $group: {
            _id: '$user',
            totalTrips: { $sum: 1 },
            completedTrips: {
              $sum: { $cond: [{ $eq: ['$status', RideStatus.RIDE_COMPLETED] }, 1, 0] },
            },
            cancelledTrips: {
              $sum: { $cond: [{ $eq: ['$status', RideStatus.RIDE_CANCELLED] }, 1, 0] },
            },
            totalSpent: {
              $sum: {
                $cond: [
                  { $eq: ['$status', RideStatus.RIDE_COMPLETED] },
                  { $ifNull: ['$payableFare', { $ifNull: ['$totalFare', 0] }] },
                  0,
                ],
              },
            },
            lastTripAt: { $max: '$createdAt' },
            latestRideId: { $last: '$_id' },
          },
        },
      ]);

      const aggMap = new Map<string, any>();
      (customerAggregations || []).forEach((agg) => {
        if (agg._id) aggMap.set(agg._id.toString(), agg);
      });

      const latestRideIds = (customerAggregations || [])
        .map((c) => c.latestRideId)
        .filter(Boolean);

      const latestRides = await this.rideModel
        .find({ _id: { $in: latestRideIds } })
        .select('pickup dropoff driver payableFare totalFare status createdAt')
        .lean();

      const latestRideMap = new Map<string, any>();
      latestRides.forEach((r: any) => {
        latestRideMap.set(r._id.toString(), r);
      });

      let combinedCustomers = companyUsers.map((userDoc: any) => {
        const uId = userDoc._id.toString();
        const agg = aggMap.get(uId);

        const fullName =
          userDoc.firstName || userDoc.lastName
            ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim()
            : 'Customer';

        const phone = userDoc.phoneNumber || '-';
        const email = userDoc.email || '-';
        const avatar = userDoc.avatar || null;
        const isActive = userDoc.isActive !== false && !(userDoc as any).isBlocked;

        const latestRide = agg?.latestRideId ? latestRideMap.get(agg.latestRideId.toString()) : null;
        const lastTripDate = latestRide?.createdAt || agg?.lastTripAt;
        const formattedLastTrip = this.formatDisplayDate(lastTripDate);
        const statusLabel = isActive ? 'Active' : 'Restricted';

        return {
          _id: uId,
          customerId: uId,
          customer: fullName,
          name: fullName,
          phone: phone,
          phoneNumber: phone,
          email: email,
          avatar: avatar,
          trips: agg?.totalTrips || 0,
          totalTrips: agg?.totalTrips || 0,
          completedTrips: agg?.completedTrips || 0,
          cancelledTrips: agg?.cancelledTrips || 0,
          totalSpent: Number((agg?.totalSpent || 0).toFixed(2)),
          currency: '₹',
          lastTrip: formattedLastTrip,
          lastTripDate: lastTripDate || null,
          lastTripDetails: latestRide
            ? {
                rideId: latestRide._id,
                date: latestRide.createdAt,
                status: latestRide.status,
                pickup: latestRide.pickup?.address || 'Pickup Point',
                dropoff: latestRide.dropoff?.address || 'Dropoff Point',
                fare: latestRide.payableFare || latestRide.totalFare || 0,
              }
            : null,
          status: statusLabel,
          statusBadge: {
            label: statusLabel,
            color: isActive ? 'green' : 'red',
            icon: isActive ? 'check-circle' : 'x-circle',
          },
          action: 'View More',
          joinedAt: userDoc.createdAt || agg?.lastTripAt,
        };
      });

      if (query.search && query.search.trim()) {
        const term = query.search.toLowerCase().trim();
        combinedCustomers = combinedCustomers.filter(
          (c) =>
            c.customer.toLowerCase().includes(term) ||
            c.phoneNumber.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term),
        );
      }

      if (query.status && query.status !== CompanyCustomerStatusFilter.ALL) {
        const filterStatus = String(query.status).toLowerCase();
        combinedCustomers = combinedCustomers.filter(
          (c) =>
            c.status.toLowerCase() === filterStatus ||
            (filterStatus === 'inactive' && c.status === 'Restricted'),
        );
      }

      combinedCustomers.sort((a, b) => {
        const timeA = a.lastTripDate
          ? new Date(a.lastTripDate).getTime()
          : a.joinedAt
          ? new Date(a.joinedAt).getTime()
          : 0;
        const timeB = b.lastTripDate
          ? new Date(b.lastTripDate).getTime()
          : b.joinedAt
          ? new Date(b.joinedAt).getTime()
          : 0;
        return timeB - timeA;
      });

      const total = combinedCustomers.length;
      const paginatedCustomers = combinedCustomers.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit) || 1;

      return new ApiResponse(
        200,
        {
          customers: paginatedCustomers,
          pagination: { total, page, limit, totalPages },
          company: company
            ? { id: company._id, name: company.displayName || company.legalName, code: company.companyId }
            : null,
          counts: {
            all: combinedCustomers.length,
            active: combinedCustomers.filter((c) => c.status === 'Active').length,
            restricted: combinedCustomers.filter((c) => c.status === 'Restricted').length,
            inactive: combinedCustomers.filter((c) => c.status === 'Restricted').length,
          },
        },
        'Same company customers fetched successfully',
      );
    } catch (error: any) {
      console.error('Error while fetching same company customers:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // 2. Get Single Company Customer Details & Trip History
  // ==========================================
  async getCompanyCustomerById(customerId: string, user: any) {
    try {
      const { company, companyIds, isGlobalAdmin } =
        await this.resolveCompanyContext(undefined, user);

      // 1. Fetch Customer User Record
      let userDoc: any = null;
      if (isValidObjectId(customerId)) {
        userDoc = await this.userModel.findById(customerId).lean();
      }
      if (!userDoc) {
        userDoc = await this.customerModel.findById(customerId).lean();
      }

      if (!userDoc) {
        return new ApiResponse(404, {}, Msg.DATA_NOT_FOUND);
      }

      // 2. Fetch Trips for this Customer with this Company
      const rideQuery: any = {
        user: isValidObjectId(customerId)
          ? { $in: [new Types.ObjectId(customerId), customerId] }
          : customerId,
      };

      if (!isGlobalAdmin && companyIds.length > 0) {
        rideQuery.companyId = { $in: companyIds };
      }

      const rides = await this.rideModel
        .find(rideQuery)
        .sort({ createdAt: -1 })
        .lean();

      // 3. Batch Drivers for rides
      const driverIds = [
        ...new Set(rides.map((r: any) => r.driver?.toString()).filter(Boolean)),
      ];
      const drivers = await this.driverModel
        .find({ _id: { $in: driverIds } })
        .select('fullName phoneNumber email vehicleType vehicleRegistrationNumber avatar rating')
        .lean();

      const driverMap = new Map(drivers.map((d: any) => [d._id.toString(), d]));

      // 4. Calculate Customer Metrics for this Company
      let totalSpent = 0;
      let completedTrips = 0;
      let cancelledTrips = 0;

      const formattedTrips = rides.map((ride: any) => {
        const driver = ride.driver ? driverMap.get(ride.driver.toString()) : null;
        const fareAmount = ride.payableFare || ride.totalFare || 0;

        if (ride.status === RideStatus.RIDE_COMPLETED) {
          totalSpent += fareAmount;
          completedTrips += 1;
        } else if (ride.status === RideStatus.RIDE_CANCELLED) {
          cancelledTrips += 1;
        }

        return {
          rideId: ride._id,
          tripId: `TRP-${ride._id.toString().slice(-4).toUpperCase()}`,
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          distanceKm: ride.distanceKm || 0,
          durationMinutes: ride.durationMinutes || 0,
          fare: {
            amount: Number(fareAmount.toFixed(2)),
            displayFare: `₹${Math.round(fareAmount)}`,
            currency: '₹',
            paymentMethod: ride.paymentMethod || null,
            paymentStatus: ride.paymentStatus || 'PENDING',
          },
          driver: driver
            ? {
                id: driver._id,
                name: driver.fullName,
                phone: driver.phoneNumber,
                vehicle: driver.vehicleType,
                registrationNumber: driver.vehicleRegistrationNumber,
                avatar: driver.avatar || null,
              }
            : null,
          status: ride.status,
          rideType: ride.rideType || 'INSTANT',
          createdAt: ride.createdAt,
          completedAt: ride.completedAt,
        };
      });

      const fullName =
        userDoc.firstName || userDoc.lastName
          ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim()
          : userDoc.fullName || 'Customer';

      return new ApiResponse(
        200,
        {
          customer: {
            id: userDoc._id,
            name: fullName,
            phone: userDoc.phoneNumber || userDoc.mobileNumber || '-',
            email: userDoc.email || '-',
            avatar: userDoc.avatar || null,
            status: userDoc.isActive !== false ? 'Active' : 'Inactive',
            joinedAt: userDoc.createdAt,
          },
          company: company
            ? {
                id: company._id,
                name: company.displayName || company.legalName,
                code: company.companyId,
              }
            : null,
          stats: {
            totalTrips: rides.length,
            completedTrips,
            cancelledTrips,
            totalSpent: Number(totalSpent.toFixed(2)),
            currency: '₹',
          },
          trips: formattedTrips,
        },
        'Customer details fetched successfully',
      );
    } catch (error: any) {
      console.error('Error while fetching company customer details:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // 3. Create / Register New Company Customer
  // ==========================================
  async createCompanyCustomer(dto: CreateCompanyCustomerDto, user: any) {
    try {
      const { company } = await this.resolveCompanyContext(
        dto.companyId,
        user,
      );

      const targetCompanyId =
        dto.companyId || (company ? company._id.toString() : user?.companyId);

      const firstName =
        dto.firstName || (dto.fullName ? dto.fullName.split(' ')[0] : 'Customer');
      const lastName =
        dto.lastName ||
        (dto.fullName ? dto.fullName.split(' ').slice(1).join(' ') : '');

      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      let userDoc = await this.userModel.findOne({
        phoneNumber: dto.phoneNumber,
      });

      if (userDoc) {
        if (firstName) userDoc.firstName = firstName;
        if (lastName) userDoc.lastName = lastName;
        if (dto.email) userDoc.email = dto.email;
        if (targetCompanyId) userDoc.companyId = targetCompanyId;
        if (!userDoc.password) userDoc.password = tempPassword;
        await userDoc.save();
      } else {
        userDoc = await this.userModel.create({
          firstName,
          lastName,
          phoneNumber: dto.phoneNumber,
          email: dto.email || undefined,
          password: tempPassword,
          companyId: targetCompanyId || undefined,
          role: UserRole.USER,
          isVerified: true,
          isActive: true,
        });
      }

      const fullName = `${firstName} ${lastName}`.trim();
      await this.customerModel.findOneAndUpdate(
        { mobileNumber: dto.phoneNumber },
        {
          fullName,
          email: dto.email || '',
          mobileNumber: dto.phoneNumber,
          createdBy: user?.id || user?._id || 'DISPATCHER',
        },
        { upsert: true, new: true },
      );

      // Send email with credentials to user if email is available
      const targetEmail = dto.email || userDoc.email;
      if (targetEmail) {
        const companyName = company ? (company.displayName || company.legalName) : 'Carline Taxi';
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
            <h2 style="color: #1a202c; font-size: 20px; font-weight: bold; margin-bottom: 16px;">Welcome to ${companyName}!</h2>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.5;">Hello ${firstName},</p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.5;">Your account has been registered with <strong>${companyName}</strong>. You can use the credentials below to log in:</p>
            
            <div style="background-color: #f7fafc; border-left: 4px solid #3182ce; padding: 16px; margin: 20px 0; border-radius: 6px;">
              <p style="margin: 4px 0; color: #2d3748; font-size: 14px;"><strong>Email:</strong> ${targetEmail}</p>
              <p style="margin: 4px 0; color: #2d3748; font-size: 14px;"><strong>Phone:</strong> ${dto.phoneNumber}</p>
              <p style="margin: 4px 0; color: #2d3748; font-size: 14px;"><strong>Password:</strong> <span style="font-family: monospace; background: #edf2f7; padding: 2px 6px; border-radius: 4px; color: #2b6cb0;">${tempPassword}</span></p>
            </div>

            <p style="color: #718096; font-size: 13px; margin-top: 24px;">Thank you for choosing ${companyName}.</p>
          </div>
        `;

        try {
          await this.mailService.sendEmail(
            targetEmail,
            `Welcome to ${companyName} - Your Account Credentials`,
            `Hello ${firstName}, your account with ${companyName} has been created. Email: ${targetEmail}, Password: ${tempPassword}`,
            emailHtml,
          );
        } catch (mailError) {
          console.error('Failed to send customer account email:', mailError);
        }
      }

      return new ApiResponse(
        201,
        {
          customer: {
            _id: userDoc._id,
            id: userDoc._id,
            name: fullName,
            customer: fullName,
            phone: userDoc.phoneNumber,
            phoneNumber: userDoc.phoneNumber,
            email: userDoc.email || '-',
            companyId: userDoc.companyId || null,
            trips: 0,
            status: 'Active',
            joinedAt: (userDoc as any).createdAt,
          },
        },
        'Customer added successfully and credentials emailed',
      );
    } catch (error: any) {
      console.error('Error while creating company customer:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // NEW API: Get Live Map Drivers & Active Trips for Dispatcher / Company Admin / SuperAdmin
  // ==========================================
  async getCompanyLiveMap(query: any, user: any) {
    try {
      const { company, companyIds, isGlobalAdmin } = await this.resolveCompanyContext(
        query?.companyId,
        user,
      );

      const driverFilter: any = {};
      if (!isGlobalAdmin && companyIds.length > 0) {
        driverFilter.companyId = { $in: companyIds };
      }

      const driversList = await this.driverModel
        .find(driverFilter)
        .select('_id userId companyId currentLatitude currentLongitude lastLocationAt isOnline status isAvailable vehicleTypeId vehicleTypeName onlineStatus dutyStatus')
        .lean();

      const userIds = driversList.map((d: any) => d.userId).filter(Boolean);
      const users = await this.userModel
        .find({ _id: { $in: userIds } })
        .select('firstName lastName phoneNumber email avatar')
        .lean();

      const userMap = new Map<string, any>();
      users.forEach((u: any) => userMap.set(u._id.toString(), u));

      const rideFilter: any = {
        status: { $in: ['SEARCHING_DRIVER', 'SCHEDULED', 'ACCEPTED', 'ARRIVED', 'ONGOING', 'PICKED_UP', 'STARTED'] }
      };
      if (!isGlobalAdmin && companyIds.length > 0) {
        rideFilter.companyId = { $in: companyIds };
      }

      const activeRides = await this.rideModel
        .find(rideFilter)
        .select('_id status pickup dropoff driver user companyId payableFare totalFare etaMinutes createdAt')
        .lean();

      const activeDriverTripMap = new Map<string, any>();
      activeRides.forEach((r: any) => {
        if (r.driver) {
          activeDriverTripMap.set(r.driver.toString(), r);
        }
      });

      let formattedDrivers = driversList.map((driverDoc: any) => {
        const uId = driverDoc.userId?.toString();
        const userDoc = userMap.get(uId) || {};
        const activeTrip = activeDriverTripMap.get(driverDoc._id.toString()) || activeDriverTripMap.get(uId);

        let mappedStatus = 'OFFLINE';
        if (activeTrip) {
          mappedStatus = 'ON_TRIP';
        } else if (driverDoc.isOnline || driverDoc.dutyStatus === 'ON_DUTY' || driverDoc.status === 'ACTIVE' || driverDoc.isAvailable) {
          mappedStatus = 'AVAILABLE';
        }

        const name = `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || 'Driver';

        return {
          id: driverDoc._id.toString(),
          userId: uId,
          name,
          phoneNumber: userDoc.phoneNumber || '',
          email: userDoc.email || '',
          avatar: userDoc.avatar || null,
          vehicleTypeName: driverDoc.vehicleTypeName || 'Standard',
          status: mappedStatus,
          isOnline: !!driverDoc.isOnline,
          latitude: driverDoc.currentLatitude || 22.7196,
          longitude: driverDoc.currentLongitude || 75.8577,
          lastLocationAt: driverDoc.lastLocationAt || null,
          activeTrip: activeTrip ? {
            rideId: activeTrip._id.toString(),
            status: activeTrip.status,
            pickup: activeTrip.pickup,
            dropoff: activeTrip.dropoff
          } : null
        };
      });

      if (query?.status && query.status !== 'All') {
        const statusTerm = query.status.toUpperCase();
        formattedDrivers = formattedDrivers.filter((d: any) => d.status === statusTerm);
      }

      if (query?.search && query.search.trim()) {
        const term = query.search.toLowerCase().trim();
        formattedDrivers = formattedDrivers.filter(
          (d: any) =>
            d.name.toLowerCase().includes(term) ||
            d.phoneNumber.toLowerCase().includes(term) ||
            d.vehicleTypeName.toLowerCase().includes(term)
        );
      }

      const formattedTrips = activeRides.map((ride: any) => ({
        id: ride._id.toString(),
        status: ride.status,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        driverId: ride.driver ? ride.driver.toString() : null,
        payableFare: ride.payableFare || 0,
        createdAt: ride.createdAt
      }));

      return new ApiResponse(
        200,
        {
          summary: {
            totalDrivers: driversList.length,
            onlineDrivers: formattedDrivers.filter((d: any) => d.status !== 'OFFLINE').length,
            availableDrivers: formattedDrivers.filter((d: any) => d.status === 'AVAILABLE').length,
            onTripDrivers: formattedDrivers.filter((d: any) => d.status === 'ON_TRIP').length,
            offlineDrivers: formattedDrivers.filter((d: any) => d.status === 'OFFLINE').length,
            activeTripsCount: activeRides.length
          },
          drivers: formattedDrivers,
          activeTrips: formattedTrips,
          company: company
            ? { id: company._id, name: company.displayName || company.legalName, code: company.companyId }
            : null
        },
        'Company live map data fetched successfully'
      );
    } catch (error: any) {
      console.error('Error in getCompanyLiveMap:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }
}
