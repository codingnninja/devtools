import { AnalysisEntry, Location, PointDescription } from "@recordreplay/protocol";
import { AnalysisParams } from "protocol/analysisManager";
import { gAnalysisCallbacks, sendMessage } from "protocol/socket";

interface Analysis {
  addLocation: (location: Location) => Promise<void>;
  findPoints: () => Promise<FindAnalysisPointsResult>;
  runAnalysis: () => Promise<RunAnalysisResult>;
  releaseAnalysis: () => Promise<void>;
}

enum AnalysisError {
  TooManyPointsToFind,
  TooManyPointsToRun,
}

interface FindAnalysisPointsResult {
  points: PointDescription[];
  error: AnalysisError.TooManyPointsToFind | undefined;
}

interface RunAnalysisResult {
  results: AnalysisEntry[];
  error: AnalysisError.TooManyPointsToRun | undefined;
}

export const createAnalysis = async (params: AnalysisParams): Promise<Analysis> => {
  // Call to the client and say hey please make an analysis and after that
  // create an Analysis with that result
  const { analysisId } = await sendMessage(
    "Analysis.createAnalysis",
    {
      mapper: params.mapper,
      reducer: params.reducer,
      effectful: params.effectful,
    },
    params.sessionId
  );
  const points: PointDescription[] = [];
  const results: AnalysisEntry[] = [];
  gAnalysisCallbacks.set(analysisId, {
    onEvent: receivedPoints => {
      points.push(...receivedPoints);
    },
    onCreate: console.log,
    onResults: console.log,
  });
  return {
    async findPoints() {
      try {
        await sendMessage("Analysis.findAnalysisPoints", { analysisId }, params.sessionId);
        return {
          points,
          error: undefined,
        };
      } catch {
        return {
          points,
          error: AnalysisError.TooManyPointsToFind,
        };
      }
    },
    async addLocation(location: Location) {
      await sendMessage("Analysis.addLocation", { analysisId, location }, params.sessionId);
      return;
    },
    async runAnalysis() {
      try {
        await sendMessage("Analysis.runAnalysis", { analysisId }, params.sessionId);
        return {
          results,
          error: undefined,
        };
      } catch {
        return {
          results,
          error: AnalysisError.TooManyPointsToRun,
        };
      }
    },
    async releaseAnalysis() {
      await sendMessage("Analysis.releaseAnalysis", { analysisId }, params.sessionId);
      return;
    },
  };
};
