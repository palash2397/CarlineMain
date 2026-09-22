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
            displayFare: `₹${Math.round(fareAmount)}`,
            currency: '₹',
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
            currency: '₹',
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
}
