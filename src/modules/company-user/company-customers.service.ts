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

import {
  GetCompanyCustomersQueryDto,
  CompanyCustomerStatusFilter,
} from './dto/get-company-customers-query.dto';

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
  ) {}

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
  // 1. Get All Company Customers (Paginated & Filterable)
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
            driverIds: { $addToSet: '$driver' },
          },
        },
      ]);

      if (!customerAggregations || customerAggregations.length === 0) {
        return new ApiResponse(
          200,
          {
            customers: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
            },
            company: company
              ? {
                  id: company._id,
                  name: company.displayName || company.legalName,
                  code: company.companyId,
                }
              : null,
            counts: {
              all: 0,
              active: 0,
              inactive: 0,
            },
          },
          'Company customers fetched successfully',
        );
      }

      // 3. Fetch User Profiles for these Customer IDs
      const rawUserIds = customerAggregations
        .map((c) => c._id)
        .filter(Boolean);

      const objectIds = rawUserIds
        .filter((id) => isValidObjectId(id))
        .map((id) => new Types.ObjectId(id));

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

      // Also check Customer schema fallback for phone-based records
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

      // 4. Batch fetch Latest Rides to get route & driver summary
      const latestRideIds = customerAggregations
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

      // 5. Build Combined Customer Data
      let combinedCustomers = customerAggregations.map((agg) => {
        const uId = agg._id?.toString();
        const userDoc = userMap.get(uId);
        const legacyDoc = legacyCustomerMap.get(uId) || (userDoc?.phoneNumber ? legacyCustomerMap.get(userDoc.phoneNumber) : null);

        const fullName =
          userDoc?.firstName || userDoc?.lastName
            ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim()
            : legacyDoc?.fullName || 'Customer';

        const phone = userDoc?.phoneNumber || legacyDoc?.mobileNumber || '-';
        const email = userDoc?.email || legacyDoc?.email || '-';
        const avatar = userDoc?.avatar || null;
        const isActive = userDoc ? userDoc.isActive !== false : true;

        const latestRide = agg.latestRideId
          ? latestRideMap.get(agg.latestRideId.toString())
          : null;

        return {
          customerId: uId,
          name: fullName,
          phoneNumber: phone,
          email: email,
          avatar: avatar,
          status: isActive ? 'Active' : 'Inactive',
          totalTrips: agg.totalTrips || 0,
          completedTrips: agg.completedTrips || 0,
          cancelledTrips: agg.cancelledTrips || 0,
          totalSpent: Number((agg.totalSpent || 0).toFixed(2)),
          currency: '₹',
          lastTrip: latestRide
            ? {
                rideId: latestRide._id,
                date: latestRide.createdAt,
                status: latestRide.status,
                pickup: latestRide.pickup?.address || 'Pickup Point',
                dropoff: latestRide.dropoff?.address || 'Dropoff Point',
                fare: latestRide.payableFare || latestRide.totalFare || 0,
              }
            : null,
          joinedAt: userDoc?.createdAt || legacyDoc?.createdAt || agg.lastTripAt,
        };
      });

      // 6. Apply Search Filter
      if (query.search && query.search.trim()) {
        const term = query.search.toLowerCase().trim();
        combinedCustomers = combinedCustomers.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.phoneNumber.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term),
        );
      }

      // 7. Apply Status Filter
      if (
        query.status &&
        query.status !== CompanyCustomerStatusFilter.ALL
      ) {
        const filterStatus = String(query.status).toLowerCase();
        combinedCustomers = combinedCustomers.filter(
          (c) => c.status.toLowerCase() === filterStatus,
        );
      }

      // 8. Sort by Most Recent Trip Date
      combinedCustomers.sort((a, b) => {
        const timeA = a.lastTrip?.date ? new Date(a.lastTrip.date).getTime() : 0;
        const timeB = b.lastTrip?.date ? new Date(b.lastTrip.date).getTime() : 0;
        return timeB - timeA;
      });

      // 9. Status Counts for UI Tabs
      const allCount = combinedCustomers.length;
      const activeCount = combinedCustomers.filter((c) => c.status === 'Active').length;
      const inactiveCount = combinedCustomers.filter((c) => c.status === 'Inactive').length;

      // 10. Paginate
      const total = combinedCustomers.length;
      const paginatedCustomers = combinedCustomers.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit) || 1;

      return new ApiResponse(
        200,
        {
          customers: paginatedCustomers,
          pagination: {
            total,
            page,
            limit,
            totalPages,
          },
          company: company
            ? {
                id: company._id,
                name: company.displayName || company.legalName,
                code: company.companyId,
              }
            : null,
          counts: {
            all: allCount,
            active: activeCount,
            inactive: inactiveCount,
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
}
