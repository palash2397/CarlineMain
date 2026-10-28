import { CommissionType } from 'src/common/enums/commission/commission-type.enum';
import { CommissionConfig } from 'src/common/schemas/commission-config.schema';

export function calculateCommissionAmount(
  fareAmount: number,
  config?: CommissionConfig | null,
): number {
  if (
    !config ||
    config.isEnabled === false ||
    !config.value ||
    config.value <= 0
  ) {
    return 0;
  }

  const base = Math.max(0, Number(fareAmount || 0));

  if (config.type === CommissionType.FLAT) {
    return Number(Math.min(config.value, base).toFixed(2));
  }

  // Default: PERCENTAGE
  const commission = (base * config.value) / 100;
  return Number(commission.toFixed(2));
}

export interface RideCommissionResult {
  fareAmount: number;
  superAdminCommission: {
    type: CommissionType;
    value: number;
    amount: number;
    isEnabled: boolean;
  };
  companyCommission: {
    type: CommissionType;
    value: number;
    amount: number;
    isEnabled: boolean;
    isCustomDriverRate: boolean;
  };
  driverEarnings: number;
  companyEarnings: number;
  platformEarnings: number;
}

export function calculateRideCommissions(params: {
  fareAmount: number;
  company?: any | null;
  driver?: any | null;
}): RideCommissionResult {
  const fare = Math.max(0, Number(params.fareAmount || 0));

  const hasCompany = Boolean(params.company || params.driver?.companyId);

  // Independent Driver directly under SuperAdmin (no company involved)
  if (!hasCompany) {
    const customDriverConfig: CommissionConfig | null =
      params.driver?.commission && params.driver.commission.isEnabled !== false
        ? params.driver.commission
        : null;

    const isCustom = Boolean(customDriverConfig);
    const superAdminDriverConfig: CommissionConfig = customDriverConfig || {
      type: CommissionType.PERCENTAGE,
      value: 15,
      isEnabled: true,
    };

    const commissionAmount = calculateCommissionAmount(
      fare,
      superAdminDriverConfig,
    );
    const driverEarnings = Number(
      Math.max(0, fare - commissionAmount).toFixed(2),
    );

    return {
      fareAmount: fare,
      superAdminCommission: {
        type: superAdminDriverConfig.type || CommissionType.PERCENTAGE,
        value: Number(superAdminDriverConfig.value || 0),
        amount: commissionAmount,
        isEnabled: superAdminDriverConfig.isEnabled !== false,
      },
      companyCommission: {
        type: CommissionType.PERCENTAGE,
        value: 0,
        amount: 0,
        isEnabled: false,
        isCustomDriverRate: false,
      },
      driverEarnings,
      companyEarnings: 0,
      platformEarnings: commissionAmount,
    };
  }

  // 1. Tier 1: Superadmin -> Company
  const superAdminConfig: CommissionConfig = params.company
    ?.superAdminCommission || {
    type: CommissionType.PERCENTAGE,
    value: 5,
    isEnabled: true,
  };
  const superAdminAmount = calculateCommissionAmount(fare, superAdminConfig);

  // 2. Tier 2: Company -> Driver
  const customDriverConfig: CommissionConfig | null =
    params.driver?.commission && params.driver.commission.isEnabled !== false
      ? params.driver.commission
      : null;

  const isCustom = Boolean(customDriverConfig);
  const driverConfig: CommissionConfig = customDriverConfig ||
    params.company?.defaultDriverCommission || {
      type: CommissionType.PERCENTAGE,
      value: 15,
      isEnabled: true,
    };

  const companyAmount = calculateCommissionAmount(fare, driverConfig);

  // 3. Driver Earnings = Fare - Company Commission
  const driverEarnings = Number(Math.max(0, fare - companyAmount).toFixed(2));

  // 4. Company Net Earnings = Company Commission - SuperAdmin Commission
  const companyEarnings = Number(
    Math.max(0, companyAmount - superAdminAmount).toFixed(2),
  );

  return {
    fareAmount: fare,
    superAdminCommission: {
      type: superAdminConfig.type || CommissionType.PERCENTAGE,
      value: Number(superAdminConfig.value || 0),
      amount: superAdminAmount,
      isEnabled: superAdminConfig.isEnabled !== false,
    },
    companyCommission: {
      type: driverConfig.type || CommissionType.PERCENTAGE,
      value: Number(driverConfig.value || 0),
      amount: companyAmount,
      isEnabled: driverConfig.isEnabled !== false,
      isCustomDriverRate: isCustom,
    },
    driverEarnings,
    companyEarnings,
    platformEarnings: superAdminAmount,
  };
}
