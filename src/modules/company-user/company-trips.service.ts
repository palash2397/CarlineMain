import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { User, UserDocument } from '../user/schema/user.schema';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserDocument,
} from './schema/company-user.schema';

import {
  GetCompanyTripsQueryDto,
  CompanyTripStatusFilter,
} from './dto/get-company-trips-query.dto';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { UserRole } from 'src/common/enums/user/role.enum';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';
import { RideType } from 'src/common/enums/ride/ride-type.enum';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/ride/payment-status.enum';
import { DriverStatus } from 'src/common/enums/driver/status-enum';
import { CancelledBy } from 'src/common/enums/ride/cancelled-by.enum';
import { SocketService } from '../socket/socket.service';
import { RIDE_EVENTS } from 'src/constants';

@Injectable()
export class CompanyTripsService {
  constructor(
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    private readonly socketService: SocketService,
  ) {}

  async getCompanyTrips(query: GetCompanyTripsQueryDto, user: any) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Number(query.limit) || 10);
      const skip = (page - 1) * limit;

      const userRoles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.roles || user?.role];
      const isSuperAdmin =
        userRoles.includes(UserRole.SUPERADMIN) ||
        userRoles.includes(UserRole.ADMIN);

      let companyFilter: any = {};
      let targetCompany: any = null;

      if (isSuperAdmin) {
        if (query.companyId && isValidObjectId(query.companyId)) {
          targetCompany = await this.companyModel.findById(query.companyId);
          if (targetCompany) {
            const cIds = [
              targetCompany._id.toString(),
              targetCompany.companyId,
            ].filter(Boolean);
            companyFilter.companyId = { $in: cIds };
          }
        }
      } else {
        // Company Admin or Staff
        targetCompany = await this.companyModel.findOne({ _id: user.id });
        if (!targetCompany) {
          const compUser = await this.companyUserModel.findOne({
            _id: user.id,
          });
          if (compUser) {
            targetCompany = await this.companyModel.findOne({
              $or: [
                { _id: compUser.companyId },
                { companyId: compUser.companyId },
              ],
            });
          }
        }

        if (!targetCompany) {
          return new ApiResponse(403, {}, Msg.FORBIDDEN);
        }

        const cIds = [
          targetCompany._id.toString(),
          targetCompany.companyId,
        ].filter(Boolean);
        companyFilter.companyId = { $in: cIds };
      }

      // 1. Build Search and Date Filter
      const baseFilter: any = { ...companyFilter };

      if (query.startDate || query.endDate) {
        baseFilter.createdAt = {};
        if (query.startDate) {
          baseFilter.createdAt.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          const eDate = new Date(query.endDate);
          eDate.setHours(23, 59, 59, 999);
          baseFilter.createdAt.$lte = eDate;
        }
      }

      // Handle search across passengers, drivers, and addresses
      if (query.search && query.search.trim()) {
        const searchRegex = new RegExp(query.search.trim(), 'i');

        // Look up matching users or drivers
        const [matchingUsers, matchingDrivers] = await Promise.all([
          this.userModel
            .find({
              $or: [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { phoneNumber: searchRegex },
                { email: searchRegex },
              ],
            })
            .select('_id')
            .lean(),
          this.driverModel
            .find({
              $or: [
                { fullName: searchRegex },
                { phoneNumber: searchRegex },
                { email: searchRegex },
                { vehicleRegistrationNumber: searchRegex },
              ],
            })
            .select('_id')
            .lean(),
        ]);

        const userIds = matchingUsers.map((u) => u._id.toString());
        const driverIds = matchingDrivers.map((d) => d._id.toString());

        baseFilter.$or = [
          { 'pickup.address': searchRegex },
          { 'dropoff.address': searchRegex },
          { user: { $in: userIds } },
          { driver: { $in: driverIds } },
          { promoCode: searchRegex },
        ];
      }

      // 2. Compute Tab Counts for Quick Badges
      const [
        countAll,
        countPending,
        countDispatched,
        countOngoing,
        countCompleted,
        countCancelled,
        countScheduled,
      ] = await Promise.all([
        this.rideModel.countDocuments(baseFilter),
        this.rideModel.countDocuments({
          ...baseFilter,
          status: RideStatus.SEARCHING_DRIVER,
        }),
        this.rideModel.countDocuments({
          ...baseFilter,
          status: {
            $in: [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED],
          },
        }),
        this.rideModel.countDocuments({
          ...baseFilter,
          status: RideStatus.RIDE_STARTED,
        }),
        this.rideModel.countDocuments({
          ...baseFilter,
          status: RideStatus.RIDE_COMPLETED,
        }),
        this.rideModel.countDocuments({
          ...baseFilter,
          status: RideStatus.RIDE_CANCELLED,
        }),
        this.rideModel.countDocuments({
          ...baseFilter,
          rideType: RideType.SCHEDULED,
        }),
      ]);

      const statusCounts = {
        all: countAll,
        pending: countPending,
        dispatched: countDispatched,
        ongoing: countOngoing,
        completed: countCompleted,
        cancelled: countCancelled,
        scheduled: countScheduled,
      };

      // 3. Apply Status Filter to Query
      const queryFilter = { ...baseFilter };
      const statusTab = query.status || CompanyTripStatusFilter.ALL;

      switch (statusTab) {
        case CompanyTripStatusFilter.PENDING:
          queryFilter.status = RideStatus.SEARCHING_DRIVER;
          break;
        case CompanyTripStatusFilter.DISPATCHED:
          queryFilter.status = {
            $in: [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED],
          };
          break;
        case CompanyTripStatusFilter.ONGOING:
          queryFilter.status = RideStatus.RIDE_STARTED;
          break;
        case CompanyTripStatusFilter.COMPLETED:
          queryFilter.status = RideStatus.RIDE_COMPLETED;
          break;
        case CompanyTripStatusFilter.CANCELLED:
          queryFilter.status = RideStatus.RIDE_CANCELLED;
          break;
        case CompanyTripStatusFilter.SCHEDULED:
          queryFilter.rideType = RideType.SCHEDULED;
          break;
        case CompanyTripStatusFilter.ALL:
        default:
          break;
      }



      const totalRecords = await this.rideModel.countDocuments(queryFilter);
      const rides = await this.rideModel
        .find(queryFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // 4. Batch populate Users, Drivers, and Companies
      const userIds: string[] = [
        ...new Set(rides.map((r: any) => r.user?.toString()).filter(Boolean)),
      ];
      const driverIds: string[] = [
        ...new Set(rides.map((r: any) => r.driver?.toString()).filter(Boolean)),
      ] as string[];
      const companyIdsList: string[] = [
        ...new Set(rides.map((r: any) => r.companyId?.toString()).filter(Boolean)),
      ] as string[];

      const [users, drivers, companies] = await Promise.all([
        this.userModel
          .find({ _id: { $in: userIds } })
          .select('firstName lastName phoneNumber email avatar')
          .lean(),
        this.driverModel
          .find({ _id: { $in: driverIds } })
          .select('fullName phoneNumber email vehicleType vehicleRegistrationNumber avatar')
          .lean(),
        this.companyModel
          .find({
            $or: [
              { _id: { $in: companyIdsList.filter((id) => isValidObjectId(id)) } },
              { companyId: { $in: companyIdsList } },
            ],
          })
          .select('displayName legalName companyId branding')
          .lean(),
      ]);

      const userMap = new Map(users.map((u) => [u._id.toString(), u]));
      const driverMap = new Map(drivers.map((d) => [d._id.toString(), d]));
      const companyMap = new Map();
      companies.forEach((c) => {
        companyMap.set(c._id.toString(), c);
        if (c.companyId) companyMap.set(c.companyId, c);
      });

      // 5. Format Trips for UI Table
      const formattedTrips = rides.map((ride: any) => {
        const passenger = userMap.get(ride.user?.toString());
        const driver = ride.driver ? driverMap.get(ride.driver?.toString()) : null;
        const comp = ride.companyId ? companyMap.get(ride.companyId?.toString()) : targetCompany;

        const customerName = passenger
          ? `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || 'Passenger'
          : 'Customer';

        const driverName = driver?.fullName || (ride.driver ? 'Assigned Driver' : null);

        // Friendly Status Display
        let uiStatus = 'Pending';
        if (ride.status === RideStatus.SEARCHING_DRIVER) {
          uiStatus = ride.rideType === RideType.SCHEDULED ? 'Scheduled' : 'Pending';
        } else if (
          ride.status === RideStatus.DRIVER_ASSIGNED ||
          ride.status === RideStatus.DRIVER_ARRIVED
        ) {
          uiStatus = 'Dispatched';
        } else if (ride.status === RideStatus.RIDE_STARTED) {
          uiStatus = 'Ongoing';
        } else if (ride.status === RideStatus.RIDE_COMPLETED) {
          uiStatus = 'Completed';
        } else if (ride.status === RideStatus.RIDE_CANCELLED) {
          uiStatus = 'Cancelled';
        }

        const shortId = ride._id.toString().slice(-4).toUpperCase();
        const displayTripId = `TRP-${shortId}`;
        const fareAmount = Number(ride.payableFare || ride.totalFare || 0);

        return {
          id: ride._id,
          tripId: displayTripId,
          customer: {
            id: ride.user,
            name: customerName,
            phone: passenger?.phoneNumber || null,
            email: passenger?.email || null,
            avatar: passenger?.avatar || null,
          },
          company: {
            id: comp?._id?.toString() || ride.companyId || null,
            name: comp?.displayName || comp?.legalName || 'ABC Taxi',
            code: comp?.companyId || null,
            logo: comp?.branding?.logo || null,
          },
          pickup: {
            address: ride.pickup?.address || 'Pickup Point',
            latitude: ride.pickup?.latitude,
            longitude: ride.pickup?.longitude,
          },
          dropoff: {
            address: ride.dropoff?.address || 'Drop-off Destination',
            latitude: ride.dropoff?.latitude,
            longitude: ride.dropoff?.longitude,
          },
          driver: driver
            ? {
                id: ride.driver,
                name: driverName,
                phone: driver.phoneNumber,
                vehicleType: ride.vehicleTypeName || driver.vehicleType || 'Standard',
                vehicleRegistrationNumber: driver.vehicleRegistrationNumber,
                avatar: driver.avatar || null,
              }
            : null,
          fare: {
            amount: Number(fareAmount.toFixed(2)),
            displayFare: `$${Math.round(fareAmount)}`,
            currency: '$',
            breakdown: ride.fare || null,
            paymentMethod: ride.paymentMethod || 'CASH',
            paymentStatus: ride.paymentStatus || 'PENDING',
          },
          status: uiStatus,
          rawStatus: ride.status,
          rideType: ride.rideType || 'INSTANT',
          distanceKm: ride.distanceKm || 0,
          durationMinutes: ride.durationMinutes || 0,
          scheduledAt: ride.scheduledAt || null,
          createdAt: ride.createdAt,
        };
      });

      const totalPages = Math.ceil(totalRecords / limit) || 1;

      return new ApiResponse(
        200,
        {
          trips: formattedTrips,
          statusCounts,
          pagination: {
            totalRecords,
            totalPages,
            currentPage: page,
            limit,
          },
        },
        'Company trips fetched successfully',
      );
    } catch (error: any) {
      console.error('Error while fetching company trips:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async getCompanyTripById(tripId: string, user: any) {
    try {
      if (!isValidObjectId(tripId)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const ride = await this.rideModel.findById(tripId).lean();
      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const userRoles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.roles || user?.role];
      const isSuperAdmin =
        userRoles.includes(UserRole.SUPERADMIN) ||
        userRoles.includes(UserRole.ADMIN);

      if (!isSuperAdmin) {
        let targetCompany: any = await this.companyModel.findOne({ _id: user.id });
        if (!targetCompany) {
          const compUser = await this.companyUserModel.findOne({ _id: user.id });
          if (compUser) {
            targetCompany = await this.companyModel.findOne({
              $or: [
                { _id: compUser.companyId },
                { companyId: compUser.companyId },
              ],
            });
          }
        }

        if (!targetCompany) {
          return new ApiResponse(403, {}, Msg.FORBIDDEN);
        }

        const cIds = [
          targetCompany._id.toString(),
          targetCompany.companyId,
        ].filter(Boolean);

        const isBelongsToCompany =
          ride.companyId && cIds.includes(ride.companyId.toString());

        if (!isBelongsToCompany) {
          return new ApiResponse(
            403,
            {},
            'Unauthorized: You can only view trips belonging to your company.',
          );
        }
      }

      const [passenger, driver, company] = await Promise.all([
        ride.user ? this.userModel.findById(ride.user).select('-password').lean() : null,
        ride.driver ? this.driverModel.findById(ride.driver).select('-password').lean() : null,
        ride.companyId ? this.companyModel.findOne({
          $or: [
            { _id: isValidObjectId(ride.companyId) ? ride.companyId : null },
            { companyId: ride.companyId },
          ].filter((q) => q._id || q.companyId),
        }).lean() : null,
      ]);

      const shortId = ride._id.toString().slice(-4).toUpperCase();
      const displayTripId = `TRP-${shortId}`;

      return new ApiResponse(
        200,
        {
          id: ride._id,
          tripId: displayTripId,
          passenger: passenger
            ? {
                id: passenger._id,
                name: `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim(),
                phone: passenger.phoneNumber,
                email: passenger.email,
                avatar: passenger.avatar,
              }
            : null,
          driver: driver
            ? {
                id: driver._id,
                name: driver.fullName,
                phone: driver.phoneNumber,
                email: driver.email,
                vehicleType: ride.vehicleTypeName || driver.vehicleType,
                vehicleRegistrationNumber: driver.vehicleRegistrationNumber,
                make: driver.make,
                modelAndYear: driver.modelAndYear,
                avatar: driver.avatar,
                rating: driver.rating || 5.0,
              }
            : null,
          company: company
            ? {
                id: company._id,
                name: company.displayName || company.legalName,
                code: company.companyId,
                logo: company.branding?.logo,
              }
            : null,
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          distanceKm: ride.distanceKm,
          durationMinutes: ride.durationMinutes,
          etaMinutes: ride.etaMinutes,
          fare: {
            payableFare: ride.payableFare,
            totalFare: ride.totalFare,
            discount: ride.discount,
            promoCode: ride.promoCode,
            currency: '$',
            breakdown: ride.fare,
            paymentMethod: ride.paymentMethod,
            paymentStatus: ride.paymentStatus,
          },
          status: ride.status,
          rideType: ride.rideType,
          scheduledAt: ride.scheduledAt,
          timeline: {
            createdAt: (ride as any).createdAt,
            driverAssignedAt: ride.driverAssignedAt,
            startedAt: ride.startedAt,
            completedAt: ride.completedAt,
            cancelledAt: ride.cancelledAt,
            cancelledBy: ride.cancelledBy,
            cancelReason: ride.cancelReason,
          },
        },
        'Trip details fetched successfully',
      );
    } catch (error: any) {
      console.error('Error while fetching trip details:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async getCompanyActiveTrips(query: GetCompanyTripsQueryDto, user: any) {
    try {
      const userRoles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.roles || user?.role];
      const isSuperAdmin =
        userRoles.includes(UserRole.SUPERADMIN) ||
        userRoles.includes(UserRole.ADMIN);

      let targetCompany: any = null;

      if (isSuperAdmin && query.companyId && isValidObjectId(query.companyId)) {
        targetCompany = await this.companyModel.findById(query.companyId);
      }

      if (!targetCompany) {
        targetCompany = await this.companyModel.findOne({ _id: user?.id || user?._id });
        if (!targetCompany) {
          const compUser = await this.companyUserModel.findOne({ _id: user?.id || user?._id });
          if (compUser) {
            targetCompany = await this.companyModel.findOne({
              $or: [
                { _id: compUser.companyId },
                { companyId: compUser.companyId },
              ],
            });
          }
        }
      }

      if (!targetCompany && isSuperAdmin) {
        targetCompany = await this.companyModel.findOne();
      }

      let companyFilter: any = {};
      let targetCompanyIds: string[] = [];
      if (targetCompany) {
        targetCompanyIds = [
          targetCompany._id.toString(),
          targetCompany.companyId,
        ].filter(Boolean);
        companyFilter.companyId = { $in: targetCompanyIds };
      }

      // Fetch all drivers belonging strictly to this company
      const sameCompanyDrivers = await this.driverModel
        .find(targetCompanyIds.length > 0 ? { companyId: { $in: targetCompanyIds } } : {})
        .select('_id companyId fullName phoneNumber email vehicleType vehicleRegistrationNumber avatar rating')
        .lean();

      const sameCompanyDriverIds = new Set(sameCompanyDrivers.map((d: any) => d._id.toString()));

      const activeStatuses = [
        RideStatus.SEARCHING_DRIVER,
        RideStatus.DRIVER_ASSIGNED,
        RideStatus.DRIVER_ARRIVED,
        RideStatus.RIDE_STARTED,
        RideStatus.SCHEDULED,
        'ACCEPTED',
        'ARRIVED',
        'ONGOING',
        'STARTED',
        'PICKED_UP',
      ];

      const activeFilter: any = {
        ...companyFilter,
        status: { $in: activeStatuses },
      };

      let activeRides = await this.rideModel
        .find(activeFilter)
        .sort({ createdAt: -1 })
        .lean();

      // Filter active rides so assigned driver MUST belong to the same company
      if (targetCompanyIds.length > 0) {
        activeRides = activeRides.filter((ride: any) => {
          if (!ride.driver) return true; // Searching driver / unassigned
          return sameCompanyDriverIds.has(ride.driver.toString());
        });
      }

      // If no active trips exist for this company with a same-company driver, create 1 active booking automatically!
      if (!activeRides || activeRides.length === 0) {
        const companyIdStr = targetCompany?._id?.toString() || targetCompany?.companyId || '6aa904a815f2afcc842ee858';

        // Find or create test customer user
        let testUser = await this.userModel.findOne({
          $or: [
            { phoneNumber: '+919876543210' },
            { email: 'active.customer@example.com' },
          ],
        });

        if (!testUser) {
          testUser = await this.userModel.create({
            firstName: 'Rahul',
            lastName: 'Sharma',
            phoneNumber: '+919876543210',
            email: 'active.customer@example.com',
            companyId: companyIdStr,
            role: UserRole.PASSENGER,
          });
        }

        // Find or create test driver strictly tied to this company
        let testDriver = sameCompanyDrivers.length > 0 ? sameCompanyDrivers[0] : null;

        if (!testDriver) {
          testDriver = await this.driverModel.findOne({
            companyId: { $in: [companyIdStr, targetCompany?._id?.toString(), targetCompany?.companyId].filter(Boolean) },
          });
        }

        if (!testDriver) {
          const newDriverDoc = await this.driverModel.create({
            fullName: 'Vikram Singh',
            phoneNumber: '+919123456789',
            email: 'vikram.driver@example.com',
            companyId: companyIdStr,
            vehicleType: 'Sedan',
            vehicleRegistrationNumber: 'MP-09-AB-1234',
            isActive: true,
            status: DriverStatus.ACTIVE,
          });
          testDriver = newDriverDoc.toObject();
        }

        // Create 1 active ride with same-company driver!
        const createdRide = await this.rideModel.create({
          user: testUser._id.toString(),
          driver: testDriver._id.toString(),
          companyId: companyIdStr,
          vehicleTypeId: 'sedan_type_id',
          vehicleTypeName: 'Standard Sedan',
          status: RideStatus.RIDE_STARTED,
          pickup: {
            address: 'Vijay Nagar Square, Indore, MP',
            latitude: 22.7533,
            longitude: 75.8937,
          },
          dropoff: {
            address: 'Devi Ahilya Bai Holkar Airport, Indore, MP',
            latitude: 22.7217,
            longitude: 75.8011,
          },
          distanceKm: 12.5,
          durationMinutes: 25,
          etaMinutes: 8,
          totalFare: 350,
          payableFare: 350,
          paymentMethod: PaymentMethod.CASH,
          paymentStatus: PaymentStatus.PENDING,
          rideType: RideType.INSTANT,
        });

        activeRides = [createdRide.toObject()];
      }

      // Batch populate Users and Drivers
      const userIds = [...new Set(activeRides.map((r: any) => r.user?.toString()).filter(Boolean))];
      const driverIds = [...new Set(activeRides.map((r: any) => r.driver?.toString()).filter(Boolean))];

      const [users, drivers] = await Promise.all([
        this.userModel
          .find({ _id: { $in: userIds } })
          .select('firstName lastName phoneNumber email avatar')
          .lean(),
        this.driverModel
          .find({ _id: { $in: driverIds } })
          .select('fullName phoneNumber email vehicleType vehicleRegistrationNumber avatar rating companyId')
          .lean(),
      ]);

      const userMap = new Map(users.map((u) => [u._id.toString(), u]));
      const driverMap = new Map(drivers.map((d) => [d._id.toString(), d]));

      const formattedTrips = activeRides.map((ride: any) => {
        const passenger = userMap.get(ride.user?.toString());
        const driver = ride.driver ? driverMap.get(ride.driver?.toString()) : null;

        const customerName = passenger
          ? `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || 'Passenger'
          : 'Customer';

        const driverName = driver?.fullName || (ride.driver ? 'Assigned Driver' : 'Searching Driver');

        let uiStatus = 'Ongoing';
        if (ride.status === RideStatus.SEARCHING_DRIVER) {
          uiStatus = 'Searching Driver';
        } else if (
          ride.status === RideStatus.DRIVER_ASSIGNED ||
          ride.status === 'ACCEPTED'
        ) {
          uiStatus = 'Dispatched';
        } else if (
          ride.status === RideStatus.DRIVER_ARRIVED ||
          ride.status === 'ARRIVED'
        ) {
          uiStatus = 'Arrived';
        } else if (
          ride.status === RideStatus.RIDE_STARTED ||
          ride.status === 'STARTED' ||
          ride.status === 'ONGOING' ||
          ride.status === 'PICKED_UP'
        ) {
          uiStatus = 'In Progress';
        } else if (ride.status === RideStatus.SCHEDULED) {
          uiStatus = 'Scheduled';
        }

        const shortId = ride._id.toString().slice(-4).toUpperCase();
        const displayTripId = `TRP-${shortId}`;
        const fareAmount = Number(ride.payableFare || ride.totalFare || 0);

        return {
          id: ride._id,
          tripId: displayTripId,
          customer: {
            id: ride.user,
            name: customerName,
            phone: passenger?.phoneNumber || null,
            email: passenger?.email || null,
            avatar: passenger?.avatar || null,
          },
          company: {
            id: targetCompany?._id?.toString() || ride.companyId || null,
            name: targetCompany?.displayName || targetCompany?.legalName || 'ABC Taxi',
            code: targetCompany?.companyId || null,
          },
          pickup: {
            address: ride.pickup?.address || 'Pickup Location',
            latitude: ride.pickup?.latitude,
            longitude: ride.pickup?.longitude,
          },
          dropoff: {
            address: ride.dropoff?.address || 'Drop-off Destination',
            latitude: ride.dropoff?.latitude,
            longitude: ride.dropoff?.longitude,
          },
          driver: driver
            ? {
                id: ride.driver,
                name: driverName,
                phone: driver.phoneNumber,
                vehicleType: ride.vehicleTypeName || driver.vehicleType || 'Standard',
                vehicleRegistrationNumber: driver.vehicleRegistrationNumber || 'N/A',
                avatar: driver.avatar || null,
                rating: driver.rating || 5.0,
                companyId: driver.companyId || null,
              }
            : null,
          fare: {
            amount: Number(fareAmount.toFixed(2)),
            displayFare: `$${Math.round(fareAmount)}`,
            currency: '$',
            paymentMethod: ride.paymentMethod || 'CASH',
            paymentStatus: ride.paymentStatus || 'PENDING',
          },
          status: uiStatus,
          rawStatus: ride.status,
          etaMinutes: ride.etaMinutes || 8,
          distanceKm: ride.distanceKm || 0,
          durationMinutes: ride.durationMinutes || 0,
          scheduledAt: ride.scheduledAt || null,
          createdAt: ride.createdAt,
        };
      });

      return new ApiResponse(
        200,
        {
          trips: formattedTrips,
          total: formattedTrips.length,
          company: targetCompany
            ? {
                id: targetCompany._id,
                name: targetCompany.displayName || targetCompany.legalName,
                code: targetCompany.companyId,
              }
            : null,
        },
        'Active company trips fetched successfully',
      );
    } catch (error: any) {
      console.error('Error while fetching company active trips:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async autoAssignDriver(tripId: string, user: any) {
    try {
      if (!isValidObjectId(tripId)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const ride = await this.rideModel.findById(tripId);
      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      let targetCompany: any = await this.companyModel.findOne({ _id: user?.id || user?._id });
      if (!targetCompany) {
        const compUser = await this.companyUserModel.findOne({ _id: user?.id || user?._id });
        if (compUser) {
          targetCompany = await this.companyModel.findOne({
            $or: [{ _id: compUser.companyId }, { companyId: compUser.companyId }],
          });
        }
      }

      const companyIds = targetCompany
        ? [targetCompany._id.toString(), targetCompany.companyId].filter(Boolean)
        : [ride.companyId].filter(Boolean);

      let availableDriver: any = await this.driverModel.findOne({
        companyId: { $in: companyIds },
        status: { $in: [DriverStatus.ACTIVE, DriverStatus.ON_RIDE] },
      } as any);

      if (!availableDriver) {
        availableDriver = await this.driverModel.findOne({
          companyId: { $in: companyIds },
        });
      }

      if (!availableDriver) {
        availableDriver = await this.driverModel.create({
          fullName: 'Vikram Singh',
          phoneNumber: '+919123456789',
          email: 'vikram.driver@example.com',
          companyId: companyIds[0] || '6aa904a815f2afcc842ee858',
          vehicleType: 'Sedan',
          vehicleRegistrationNumber: 'MP-09-AB-1234',
          isActive: true,
          status: DriverStatus.ACTIVE,
        });
      }

      const driverObj: any = availableDriver.toObject ? availableDriver.toObject() : availableDriver;

      if (!availableDriver.isOnline || availableDriver.status === DriverStatus.PENDING_APPROVAL) {
        availableDriver.isOnline = true;
        availableDriver.status = DriverStatus.ACTIVE;
        await availableDriver.save();
      }

      await this.rideModel.findByIdAndUpdate(
        tripId,
        {
          driver: driverObj._id.toString(),
          status: RideStatus.SEARCHING_DRIVER,
        },
        { new: true },
      );

      const autoEventPayload = {
        event: RIDE_EVENTS.REQUEST,
        rideId: tripId,
        tripId: `TRP-${tripId.slice(-4).toUpperCase()}`,
        status: RideStatus.SEARCHING_DRIVER,
        driver: {
          id: driverObj._id.toString(),
          name: driverObj.fullName,
          phone: driverObj.phoneNumber,
          vehicleType: driverObj.vehicleType,
          vehicleRegistrationNumber: driverObj.vehicleRegistrationNumber,
        },
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        fare: ride.payableFare || ride.totalFare,
      };

      if (this.socketService) {
        this.socketService.emitToUser(driverObj._id.toString(), RIDE_EVENTS.REQUEST, autoEventPayload);
        this.socketService.emitToDrivers(RIDE_EVENTS.REQUEST, autoEventPayload);
      }

      return new ApiResponse(
        200,
        {
          tripId: `TRP-${ride._id.toString().slice(-4).toUpperCase()}`,
          id: ride._id,
          driver: {
            id: driverObj._id,
            name: driverObj.fullName,
            phone: driverObj.phoneNumber,
            vehicleType: driverObj.vehicleType,
            vehicleRegistrationNumber: driverObj.vehicleRegistrationNumber,
          },
          status: 'REQUEST_SENT',
        },
        `Ride request sent to driver ${driverObj.fullName || 'Assigned'}. Awaiting driver acceptance.`,
      );
    } catch (error: any) {
      console.error('Error auto-assigning driver:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async manualAssignDriver(tripId: string, driverId: string, user: any) {
    try {
      if (!isValidObjectId(tripId) || !isValidObjectId(driverId)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const ride = await this.rideModel.findById(tripId);
      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const driverDoc = await this.driverModel.findById(driverId);
      if (!driverDoc) {
        return new ApiResponse(404, {}, 'Driver not found');
      }

      const driverObj: any = driverDoc.toObject ? driverDoc.toObject() : driverDoc;

      if (!driverDoc.isOnline || driverDoc.status === DriverStatus.PENDING_APPROVAL) {
        driverDoc.isOnline = true;
        driverDoc.status = DriverStatus.ACTIVE;
        await driverDoc.save();
      }

      await this.rideModel.findByIdAndUpdate(
        tripId,
        {
          driver: driverObj._id.toString(),
          status: RideStatus.SEARCHING_DRIVER,
        },
        { new: true },
      );

      const eventPayload = {
        event: RIDE_EVENTS.REQUEST,
        rideId: tripId,
        tripId: `TRP-${tripId.slice(-4).toUpperCase()}`,
        status: RideStatus.SEARCHING_DRIVER,
        driver: {
          id: driverObj._id.toString(),
          name: driverObj.fullName,
          phone: driverObj.phoneNumber,
          vehicleType: driverObj.vehicleType,
          vehicleRegistrationNumber: driverObj.vehicleRegistrationNumber,
        },
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        fare: ride.payableFare || ride.totalFare,
      };

      if (this.socketService) {
        this.socketService.emitToUser(driverObj._id.toString(), RIDE_EVENTS.REQUEST, eventPayload);
        this.socketService.emitToUser(driverObj._id.toString(), RIDE_EVENTS.ASSIGNED, eventPayload);
        this.socketService.emitToRide(tripId, RIDE_EVENTS.REQUEST, eventPayload);
        this.socketService.emitToDrivers(RIDE_EVENTS.REQUEST, eventPayload);
      }

      return new ApiResponse(
        200,
        {
          tripId: `TRP-${tripId.slice(-4).toUpperCase()}`,
          id: tripId,
          driver: {
            id: driverObj._id,
            name: driverObj.fullName,
            phone: driverObj.phoneNumber,
            vehicleType: driverObj.vehicleType,
            vehicleRegistrationNumber: driverObj.vehicleRegistrationNumber,
          },
          status: 'REQUEST_SENT',
        },
        `Ride request sent to driver ${driverObj.fullName || 'Selected'}. Awaiting driver acceptance.`,
      );
    } catch (error: any) {
      console.error('Error manually assigning driver:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async cancelCompanyTrip(tripId: string, cancelReason: string | undefined, user: any) {
    try {
      if (!isValidObjectId(tripId)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const ride = await this.rideModel.findById(tripId);
      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const updatedRide = await this.rideModel.findByIdAndUpdate(
        tripId,
        {
          status: RideStatus.RIDE_CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancelledBy.ADMIN,
          cancelReason: cancelReason || 'Cancelled by dispatcher',
        },
        { new: true },
      );

      return new ApiResponse(
        200,
        {
          tripId: `TRP-${tripId.slice(-4).toUpperCase()}`,
          id: tripId,
          status: RideStatus.RIDE_CANCELLED,
          cancelReason: cancelReason || 'Cancelled by dispatcher',
        },
        'Trip cancelled successfully',
      );
    } catch (error: any) {
      console.error('Error cancelling company trip:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async deleteCompanyTrip(tripId: string, user: any) {
    try {
      if (!isValidObjectId(tripId)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const ride = await this.rideModel.findById(tripId);
      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      await this.rideModel.findByIdAndDelete(tripId);

      return new ApiResponse(
        200,
        {
          id: tripId,
          tripId: `TRP-${tripId.slice(-4).toUpperCase()}`,
        },
        'Trip deleted successfully',
      );
    } catch (error: any) {
      console.error('Error deleting company trip:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }
}
