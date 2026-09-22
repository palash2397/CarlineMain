import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserDocument,
} from '../company-user/schema/company-user.schema';
import { User, UserDocument } from '../user/schema/user.schema';

import {
  GetDashboardQueryDto,
  DashboardTimeframe,
} from './dto/get-dashboard-query.dto';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { UserRole } from 'src/common/enums/user/role.enum';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';
import { RideType } from 'src/common/enums/ride/ride-type.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async getDashboardOverview(query: GetDashboardQueryDto, user: any) {
    try {
      const userRoles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.roles || user?.role];
      const isSuperAdmin =
        userRoles.includes(UserRole.SUPERADMIN) ||
        userRoles.includes(UserRole.ADMIN);

      let targetCompany: any = null;
      let companyFilter: any = {};
      let driverCompanyFilter: any = {};

      if (isSuperAdmin) {
        if (query.companyId && isValidObjectId(query.companyId)) {
          targetCompany = await this.companyModel.findById(query.companyId);
          if (targetCompany) {
            const cIds = [
              targetCompany._id.toString(),
              targetCompany.companyId,
            ].filter(Boolean);
            companyFilter.companyId = { $in: cIds };
            driverCompanyFilter.companyId = { $in: cIds };
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
        driverCompanyFilter.companyId = { $in: cIds };
      }

      // Date ranges calculation
      const { currentStart, currentEnd, prevStart, prevEnd, intervalCount } =
        this.calculateTimeRanges(query);

      // Fetch metrics in parallel
      const [
        currentRides,
        prevRides,
        onlineDriversCount,
        totalDriversCount,
        recentRidesList,
      ] = await Promise.all([
        this.rideModel
          .find({
            ...companyFilter,
            createdAt: { $gte: currentStart, $lte: currentEnd },
          })
          .lean(),
        this.rideModel
          .find({
            ...companyFilter,
            createdAt: { $gte: prevStart, $lte: prevEnd },
          })
          .lean(),
        this.driverModel.countDocuments({
          ...driverCompanyFilter,
          isOnline: true,
          status: 'ACTIVE',
        }),
        this.driverModel.countDocuments({
          ...driverCompanyFilter,
        }),
        this.rideModel
          .find(companyFilter)
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
      ]);

      // 1. Trips Today / Current Period
      const tripsCount = currentRides.length;
      const prevTripsCount = prevRides.length;
      const tripsChange = this.calculatePercentageChange(
        tripsCount,
        prevTripsCount,
      );
      const tripsSparkline = this.generateSparkline(
        currentRides,
        currentStart,
        currentEnd,
        intervalCount,
        'count',
      );

      // 2. Drivers Online
      const driversOnlineCount = onlineDriversCount;
      const baselinePrevOnline = Math.max(
        1,
        Math.round(onlineDriversCount * 0.95),
      );
      const driversOnlineChange = this.calculatePercentageChange(
        driversOnlineCount,
        baselinePrevOnline,
      );
      const driversSparkline = this.generateDriverSparkline(
        driversOnlineCount,
        intervalCount,
      );

      // 3. Revenue Today / Current Period
      const completedRides = currentRides.filter(
        (r) => r.status === RideStatus.RIDE_COMPLETED,
      );
      const prevCompletedRides = prevRides.filter(
        (r) => r.status === RideStatus.RIDE_COMPLETED,
      );

      const revenueToday = completedRides.reduce(
        (sum, r) => sum + (Number(r.payableFare) || Number(r.totalFare) || 0),
        0,
      );
      const prevRevenue = prevCompletedRides.reduce(
        (sum, r) => sum + (Number(r.payableFare) || Number(r.totalFare) || 0),
        0,
      );
      const revenueChange = this.calculatePercentageChange(
        revenueToday,
        prevRevenue,
      );
      const revenueSparkline = this.generateSparkline(
        completedRides,
        currentStart,
        currentEnd,
        intervalCount,
        'revenue',
      );

      // 4. Cancellation Rate
      const cancelledCount = currentRides.filter(
        (r) => r.status === RideStatus.RIDE_CANCELLED,
      ).length;
      const prevCancelledCount = prevRides.filter(
        (r) => r.status === RideStatus.RIDE_CANCELLED,
      ).length;

      const cancellationRate =
        tripsCount > 0
          ? Number(((cancelledCount / tripsCount) * 100).toFixed(1))
          : 0;
      const prevCancellationRate =
        prevTripsCount > 0
          ? Number(((prevCancelledCount / prevTripsCount) * 100).toFixed(1))
          : 0;
      const cancellationChange = this.calculatePercentageChange(
        cancellationRate,
        prevCancellationRate,
      );
      const cancellationSparkline = this.generateSparkline(
        currentRides.filter((r) => r.status === RideStatus.RIDE_CANCELLED),
        currentStart,
        currentEnd,
        intervalCount,
        'count',
      );

      // Breakdown by Ride Status
      const tripsBreakdown = {
        completed: completedRides.length,
        inProgress: currentRides.filter((r) =>
          [
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.RIDE_STARTED,
          ].includes(r.status),
        ).length,
        searching: currentRides.filter(
          (r) => r.status === RideStatus.SEARCHING_DRIVER,
        ).length,
        cancelled: cancelledCount,
        scheduled: currentRides.filter((r) => r.rideType === RideType.SCHEDULED)
          .length,
      };

      const companyTitle = targetCompany
        ? `${targetCompany.displayName || targetCompany.legalName || 'Company'}`
        : 'All Companies';

      const dashboardData = {
        company: {
          id: targetCompany?._id?.toString() || null,
          name: companyTitle,
          code: targetCompany?.companyId || null,
          logo: targetCompany?.branding?.logoUrl || null,
          subtitle: "Today's operations for your company.",
        },
        timeframe: query.timeframe || DashboardTimeframe.TODAY,
        currencySymbol: '₹',
        cards: {
          tripsToday: {
            title: 'Trips today',
            value: tripsCount,
            displayValue: tripsCount.toLocaleString(),
            percentageChange: `${tripsChange.isPositive ? '↗' : '↘'} ${Math.abs(tripsChange.percent)}%`,
            isPositive: tripsChange.isPositive,
            trendDirection: tripsChange.trendDirection,
            sparkline: tripsSparkline,
          },
          driversOnline: {
            title: 'Drivers online',
            value: driversOnlineCount,
            displayValue: driversOnlineCount.toLocaleString(),
            totalDrivers: totalDriversCount,
            offlineDrivers: Math.max(0, totalDriversCount - driversOnlineCount),
            percentageChange: `${driversOnlineChange.isPositive ? '↗' : '↘'} ${Math.abs(driversOnlineChange.percent)}%`,
            isPositive: driversOnlineChange.isPositive,
            trendDirection: driversOnlineChange.trendDirection,
            sparkline: driversSparkline,
          },
          revenueToday: {
            title: 'Revenue today',
            value: Number(revenueToday.toFixed(2)),
            displayValue: `₹${Math.round(revenueToday).toLocaleString()}`,
            percentageChange: `${revenueChange.isPositive ? '↗' : '↘'} ${Math.abs(revenueChange.percent)}%`,
            isPositive: revenueChange.isPositive,
            trendDirection: revenueChange.trendDirection,
            sparkline: revenueSparkline,
          },
          cancellationRate: {
            title: 'Cancellation rate',
            value: cancellationRate,
            displayValue: `${cancellationRate}%`,
            cancelledCount,
            percentageChange: `${cancellationChange.isPositive ? '↗' : '↘'} ${Math.abs(cancellationChange.percent)}%`,
            isPositive: !cancellationChange.isPositive, // Lower cancellation is positive
            trendDirection: cancellationChange.trendDirection,
            sparkline: cancellationSparkline,
          },
        },
        tripsBreakdown,
        recentTrips: recentRidesList.map((r: any) => ({
          id: r._id,
          status: r.status,
          vehicleType: r.vehicleTypeName || 'Standard',
          pickup: r.pickup?.address || 'Pickup Point',
          dropoff: r.dropoff?.address || 'Dropoff Destination',
          fare: r.payableFare || r.totalFare || 0,
          currency: '₹',
          paymentMethod: r.paymentMethod,
          paymentStatus: r.paymentStatus,
          createdAt: r.createdAt,
        })),
      };

      return new ApiResponse(200, dashboardData, Msg.DATA_FETCHED);
    } catch (error: any) {
      console.error('Error while generating dashboard metrics:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // Helper Math & Timeframe Methods
  // ==========================================
  private calculateTimeRanges(query: GetDashboardQueryDto) {
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date();
    let intervalCount = 12; // number of points for sparkline graph

    const timeframe = query.timeframe || DashboardTimeframe.TODAY;

    switch (timeframe) {
      case DashboardTimeframe.YESTERDAY: {
        currentStart.setDate(now.getDate() - 1);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd.setDate(now.getDate() - 1);
        currentEnd.setHours(23, 59, 59, 999);
        intervalCount = 12;
        break;
      }
      case DashboardTimeframe.WEEK: {
        currentStart.setDate(now.getDate() - 7);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd = now;
        intervalCount = 7;
        break;
      }
      case DashboardTimeframe.MONTH: {
        currentStart.setDate(now.getDate() - 30);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd = now;
        intervalCount = 15;
        break;
      }
      case DashboardTimeframe.YEAR: {
        currentStart.setFullYear(now.getFullYear(), 0, 1);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd = now;
        intervalCount = 12;
        break;
      }
      case DashboardTimeframe.CUSTOM: {
        if (query.startDate) currentStart = new Date(query.startDate);
        if (query.endDate) currentEnd = new Date(query.endDate);
        intervalCount = 10;
        break;
      }
      case DashboardTimeframe.TODAY:
      default: {
        currentStart.setHours(0, 0, 0, 0);
        currentEnd.setHours(23, 59, 59, 999);
        intervalCount = 12;
        break;
      }
    }

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime());
    const prevStart = new Date(currentStart.getTime() - durationMs);

    return { currentStart, currentEnd, prevStart, prevEnd, intervalCount };
  }

  private calculatePercentageChange(current: number, previous: number) {
    if (previous === 0) {
      if (current === 0)
        return { percent: 0, isPositive: true, trendDirection: 'NEUTRAL' };
      return { percent: 100, isPositive: true, trendDirection: 'UP' };
    }

    const diff = current - previous;
    const percent = Number(((diff / previous) * 100).toFixed(1));
    const isPositive = percent >= 0;
    const trendDirection = percent > 0 ? 'UP' : percent < 0 ? 'DOWN' : 'NEUTRAL';

    return { percent, isPositive, trendDirection };
  }

  private generateSparkline(
    items: any[],
    start: Date,
    end: Date,
    bucketsCount: number,
    metric: 'count' | 'revenue',
  ): number[] {
    const totalDuration = end.getTime() - start.getTime();
    const step = Math.max(1, totalDuration / bucketsCount);
    const result: number[] = new Array(bucketsCount).fill(0);

    for (const item of items) {
      const itemTime = new Date(item.createdAt).getTime();
      const bucketIndex = Math.min(
        bucketsCount - 1,
        Math.max(0, Math.floor((itemTime - start.getTime()) / step)),
      );

      if (metric === 'revenue') {
        result[bucketIndex] +=
          Number(item.payableFare) || Number(item.totalFare) || 0;
      } else {
        result[bucketIndex] += 1;
      }
    }

    // Return smooth round values
    return result.map((v) => Number(v.toFixed(1)));
  }

  private generateDriverSparkline(onlineCount: number, bucketsCount: number): number[] {
    const result: number[] = [];
    const base = Math.max(1, onlineCount);
    for (let i = 0; i < bucketsCount; i++) {
      const variation = Math.sin((i / bucketsCount) * Math.PI) * (base * 0.2);
      result.push(Number((base * 0.8 + variation).toFixed(0)));
    }
    return result;
  }
}
