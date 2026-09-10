import { summarizeSurvey } from "./course-demand.mjs";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function captureSurveySnapshot({ survey, responses = [], eligibleStudentCount = 0, now = new Date(), source = "manual_close" } = {}) {
  const capturedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  return {
    schemaVersion: 1,
    capturedAt,
    effectiveCloseAt: source === "deadline_observed" ? String(survey?.closesAt || capturedAt) : capturedAt,
    source,
    summary: summarizeSurvey({ survey, responses, eligibleStudentCount })
  };
}

export function readSurveySummary({ survey, responses = [], eligibleStudentCount = 0 } = {}) {
  const snapshot = survey?.statisticsSnapshot;
  if (snapshot?.schemaVersion === 1 && snapshot.summary) {
    return {
      ...clone(snapshot.summary),
      statisticsBasis: "snapshot",
      statisticsSnapshot: {
        schemaVersion: snapshot.schemaVersion,
        capturedAt: snapshot.capturedAt,
        effectiveCloseAt: snapshot.effectiveCloseAt,
        source: snapshot.source
      }
    };
  }
  return {
    ...summarizeSurvey({ survey, responses, eligibleStudentCount }),
    statisticsBasis: survey?.status === "closed" ? "legacy_live" : "live"
  };
}

export function finalizeExpiredSurveys({ surveys = [], responses = [], eligibleStudentCountForSurvey, now = new Date() } = {}) {
  const nowTime = now.getTime();
  const finalized = [];
  for (const survey of surveys) {
    if (survey?.status !== "open") continue;
    const closesAt = new Date(survey.closesAt || "");
    if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() >= nowTime) continue;
    const eligibleStudentCount = Number(eligibleStudentCountForSurvey?.(survey) || 0);
    survey.statisticsSnapshot = captureSurveySnapshot({
      survey,
      responses: responses.filter((response) => response.surveyId === survey.id),
      eligibleStudentCount,
      now,
      source: "deadline_observed"
    });
    survey.status = "closed";
    survey.updatedAt = now.toISOString();
    finalized.push(survey.id);
  }
  return finalized;
}
