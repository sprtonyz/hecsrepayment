import { roundMoney } from "@/lib/domain/money";
import { addMonthsIso } from "@/lib/domain/dates";
import { projectStudyLoanDebt } from "@/lib/domain/studyLoan";
import type { ProjectionPoint } from "@/lib/domain/projections";
import type { StudyLoanProjectionPoint } from "@/lib/domain/studyLoan";

export type SchoolDecisionVerdict = "keepAapl" | "cashOut" | "close";

export type SchoolDecisionMonth = {
  date: string;
  verdict: SchoolDecisionVerdict;
  differenceAud: number;
  keepAaplNetAud: number;
  cashOutRebuildNetAud: number;
  schoolDebtAud: number;
  repaymentAud: number;
  indexationAud: number;
};

export type SchoolDecisionTimelineInput = {
  asOfDate: string;
  currentHadHeldTotalUsd: number;
  currentRebuildTotalUsd: number;
  currentSchoolDebtAud: number;
  debtAfterPayoffAud: number;
  monthlyRepaymentAud: number;
  usdToAudRate: number;
  currentCashOutDepositTopUpAud?: number;
  keepAaplProjection: ProjectionPoint[];
  cashOutRebuildProjection: ProjectionPoint[];
  schoolDebtProjection: StudyLoanProjectionPoint[];
  months: number;
  closeEnoughAud?: number;
};

export type CurrentMonthSchoolDecisionInput = {
  asOfDate: string;
  currentHadHeldTotalUsd: number;
  originalSaleProceedsUsd: number;
  currentRebuildAssetValueUsd: number;
  currentSchoolDebtAud?: number;
  debtAfterPayoffAud?: number;
  totalContributionsAud: number;
  latestUsdToAudRate: number;
  monthlyEducationRepaymentAud: number;
  currentMonthContributionAud: number;
  targetMonthContributionAud: number;
  hasCurrentValuation: boolean;
};

export type SchoolDecisionCompoundTimelineInput = {
  startDate: string;
  months: number;
  keepStartingValueAud: number;
  rebuildStartingValueAud: number;
  monthlyContributionAud: number;
  monthlyCashflowAud?: number;
  currentSchoolDebtAud?: number;
  debtAfterPayoffAud?: number;
  monthlyDebtRepaymentAud?: number;
  annualDebtIndexationRatePercent?: number;
  annualGrowthRatePercent: number;
  closeEnoughAud?: number;
};

export type CurrentMonthSchoolDecision = {
  date: string;
  verdict: SchoolDecisionVerdict;
  differenceAud: number;
  keepAaplNetAud: number;
  cashOutRebuildNetAud: number;
  keepAaplStartingValueAud: number;
  keepAaplValueAud: number;
  keepAaplMovementAud: number;
  monthlyEducationRepaymentAud: number;
  keepAaplDebtAud: number;
  rebuildAssetValueAud: number;
  rebuildMovementAud: number;
  debtAfterPayoffAud: number;
  aaplDepositAud: number;
  currentMonthContributionAud: number;
  currentMonthDepositTopUpAud: number;
};

export function buildCurrentMonthSchoolDecision(
  input: CurrentMonthSchoolDecisionInput,
): CurrentMonthSchoolDecision {
  const keepAaplStartingValueAud = roundMoney(
    input.originalSaleProceedsUsd * input.latestUsdToAudRate,
  );
  const keepAaplMovementAud = input.hasCurrentValuation
    ? roundMoney(
        (input.currentHadHeldTotalUsd - input.originalSaleProceedsUsd) *
          input.latestUsdToAudRate,
      )
    : 0;
  const keepAaplValueAud = roundMoney(
    keepAaplStartingValueAud + keepAaplMovementAud,
  );
  const monthlyEducationRepaymentAud = roundMoney(
    Math.max(0, input.monthlyEducationRepaymentAud),
  );
  const keepAaplDebtAud = roundMoney(
    Math.max(0, (input.currentSchoolDebtAud ?? 0) - monthlyEducationRepaymentAud),
  );
  const debtAfterPayoffAud = roundMoney(Math.max(0, input.debtAfterPayoffAud ?? 0));
  const rebuildAssetValueAud = roundMoney(
    Math.max(0, input.currentRebuildAssetValueUsd * input.latestUsdToAudRate),
  );
  const rebuildMovementAud = input.hasCurrentValuation
    ? roundMoney(rebuildAssetValueAud - input.totalContributionsAud)
    : 0;
  const aaplDepositAud = roundMoney(
    Math.max(input.targetMonthContributionAud, input.currentMonthContributionAud),
  );
  const currentMonthDepositTopUpAud = roundMoney(
    Math.max(0, aaplDepositAud - input.currentMonthContributionAud),
  );
  const keepAaplNetAud = roundMoney(keepAaplValueAud - monthlyEducationRepaymentAud);
  const cashOutRebuildNetAud = roundMoney(
    rebuildAssetValueAud + currentMonthDepositTopUpAud - debtAfterPayoffAud,
  );
  const differenceAud = roundMoney(cashOutRebuildNetAud - keepAaplNetAud);
  const verdict =
    Math.abs(differenceAud) <= 250
      ? "close"
      : differenceAud > 0
        ? "cashOut"
        : "keepAapl";

  return {
    date: input.asOfDate,
    verdict,
    differenceAud,
    keepAaplNetAud,
    cashOutRebuildNetAud,
    keepAaplStartingValueAud,
    keepAaplValueAud,
    keepAaplMovementAud,
    monthlyEducationRepaymentAud,
    keepAaplDebtAud,
    rebuildAssetValueAud,
    rebuildMovementAud,
    debtAfterPayoffAud,
    aaplDepositAud,
    currentMonthContributionAud: input.currentMonthContributionAud,
    currentMonthDepositTopUpAud,
  };
}

export function buildSchoolDecisionTimeline(
  input: SchoolDecisionTimelineInput,
): SchoolDecisionMonth[] {
  const closeEnoughAud = input.closeEnoughAud ?? 250;
  const currentKeepAaplNetAud = roundMoney(
    input.currentHadHeldTotalUsd * input.usdToAudRate - input.monthlyRepaymentAud,
  );
  const currentCashOutNetAud = roundMoney(
    input.currentRebuildTotalUsd * input.usdToAudRate +
      (input.currentCashOutDepositTopUpAud ?? 0) -
      input.debtAfterPayoffAud,
  );
  const months: SchoolDecisionMonth[] = [
    buildMonth({
      date: input.asOfDate,
      keepAaplNetAud: currentKeepAaplNetAud,
      cashOutRebuildNetAud: currentCashOutNetAud,
      schoolDebtAud: input.currentSchoolDebtAud,
      repaymentAud: input.monthlyRepaymentAud,
      indexationAud: 0,
      closeEnoughAud,
    }),
  ];

  for (let index = 0; index < Math.max(0, input.months - 1); index += 1) {
    const keepPoint = input.keepAaplProjection[index];
    const cashOutPoint = input.cashOutRebuildProjection[index];
    if (!keepPoint || !cashOutPoint) {
      break;
    }

    const debtPoint =
      input.schoolDebtProjection.find((point) => point.date === keepPoint.date) ??
      input.schoolDebtProjection[index + 1] ??
      input.schoolDebtProjection.at(-1);
    const schoolDebtAud = debtPoint?.balanceAud ?? 0;

    months.push(
      buildMonth({
        date: keepPoint.date,
        keepAaplNetAud: roundMoney(
          keepPoint.hadHeldValueUsd * input.usdToAudRate -
            (debtPoint?.repaymentAud ?? input.monthlyRepaymentAud),
        ),
        cashOutRebuildNetAud: roundMoney(
          cashOutPoint.rebuildValueUsd * input.usdToAudRate - input.debtAfterPayoffAud,
        ),
        schoolDebtAud,
        repaymentAud: debtPoint?.repaymentAud ?? 0,
        indexationAud: debtPoint?.indexationAud ?? 0,
        closeEnoughAud,
      }),
    );
  }

  return months;
}

export function findSchoolDecisionCrossDate(months: SchoolDecisionMonth[]) {
  return months.find((month) => month.cashOutRebuildNetAud >= month.keepAaplNetAud)?.date;
}

export function buildSchoolDecisionCompoundTimeline(
  input: SchoolDecisionCompoundTimelineInput,
): SchoolDecisionMonth[] {
  const closeEnoughAud = input.closeEnoughAud ?? 250;
  const monthlyGrowth =
    Math.pow(1 + input.annualGrowthRatePercent / 100, 1 / 12) - 1;
  let keepAaplValueAud = input.keepStartingValueAud;
  let rebuildValueAud = input.rebuildStartingValueAud;
  const debtRepaymentAud = input.monthlyDebtRepaymentAud ?? input.monthlyCashflowAud ?? 0;
  const keepDebt = projectStudyLoanDebt({
    startDate: input.startDate,
    months: input.months + 1,
    startingBalanceAud: input.currentSchoolDebtAud ?? 0,
    monthlyRepaymentAud: debtRepaymentAud,
    annualIndexationRatePercent: input.annualDebtIndexationRatePercent ?? 0,
  });
  const cashOutDebt = projectStudyLoanDebt({
    startDate: input.startDate,
    months: input.months + 1,
    startingBalanceAud: input.debtAfterPayoffAud ?? 0,
    monthlyRepaymentAud: debtRepaymentAud,
    annualIndexationRatePercent: input.annualDebtIndexationRatePercent ?? 0,
  });
  const points: SchoolDecisionMonth[] = [];

  for (let month = 0; month <= input.months; month += 1) {
    if (month > 0) {
      keepAaplValueAud *= 1 + monthlyGrowth;
      rebuildValueAud = (rebuildValueAud + input.monthlyContributionAud) * (1 + monthlyGrowth);
    }
    const keepDebtPoint = keepDebt.points[month];
    const cashOutDebtPoint = cashOutDebt.points[month];
    const cashOutDebtBalanceAud = cashOutDebtPoint?.balanceAud ?? 0;
    const monthlyKeepCashflowAud = keepDebtPoint?.repaymentAud ?? debtRepaymentAud;

    points.push(
      buildMonth({
        date: addMonthsIso(input.startDate, month),
        keepAaplNetAud: roundMoney(keepAaplValueAud - monthlyKeepCashflowAud),
        cashOutRebuildNetAud: roundMoney(rebuildValueAud - cashOutDebtBalanceAud),
        schoolDebtAud: keepDebtPoint?.balanceAud ?? 0,
        repaymentAud: keepDebtPoint?.repaymentAud ?? 0,
        indexationAud: keepDebtPoint?.indexationAud ?? 0,
        closeEnoughAud,
      }),
    );
  }

  return points;
}

function buildMonth({
  date,
  keepAaplNetAud,
  cashOutRebuildNetAud,
  schoolDebtAud,
  repaymentAud,
  indexationAud,
  closeEnoughAud,
}: {
  date: string;
  keepAaplNetAud: number;
  cashOutRebuildNetAud: number;
  schoolDebtAud: number;
  repaymentAud: number;
  indexationAud: number;
  closeEnoughAud: number;
}): SchoolDecisionMonth {
  const differenceAud = roundMoney(cashOutRebuildNetAud - keepAaplNetAud);
  const verdict =
    Math.abs(differenceAud) <= closeEnoughAud
      ? "close"
      : differenceAud > 0
        ? "cashOut"
        : "keepAapl";

  return {
    date,
    verdict,
    differenceAud,
    keepAaplNetAud,
    cashOutRebuildNetAud,
    schoolDebtAud,
    repaymentAud,
    indexationAud,
  };
}
