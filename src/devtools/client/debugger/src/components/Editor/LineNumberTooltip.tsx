import { updateHoveredLineNumber } from "devtools/client/debugger/src/actions/breakpoints/index";
import { setBreakpointHitCounts } from "devtools/client/debugger/src/actions/sources";
import { minBy } from "lodash";
import { AnalysisParams } from "protocol/analysisManager";
import { Analysis, AnalysisError, createAnalysis } from "protocol/thread/analysis";
import React, { useRef, useState, useEffect, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { UIThunkAction } from "ui/actions";
import { saveAnalysisError } from "ui/actions/logpoint";
import { KeyModifiers } from "ui/components/KeyModifiers";
import MaterialIcon from "ui/components/shared/MaterialIcon";
import hooks from "ui/hooks";
import { Nag } from "ui/hooks/users";
import { selectors } from "ui/reducers";
import { setAnalysisPoints, setHoveredLineNumberLocation } from "ui/reducers/app";
import { AnalysisPayload } from "ui/state/app";
import { UnsafeFocusRegion } from "ui/state/timeline";
import { features } from "ui/utils/prefs";
import { trackEvent } from "ui/utils/telemetry";
import { shouldShowNag } from "ui/utils/user";

import { getHitCountsForSelectedSource, getSelectedSource } from "../../reducers/sources";
import {
  analysisCreated,
  analysisErrored,
  analysisPointsReceived,
  analysisPointsRequested,
  getFirstBreakpointPosition,
} from "../../selectors";

import StaticTooltip from "./StaticTooltip";

export const AWESOME_BACKGROUND = `linear-gradient(116.71deg, #FF2F86 21.74%, #EC275D 83.58%), linear-gradient(133.71deg, #01ACFD 3.31%, #F155FF 106.39%, #F477F8 157.93%, #F33685 212.38%), #007AFF`;

function Wrapper({
  children,
  loading,
  showWarning,
}: {
  children: ReactNode;
  loading?: boolean;
  showWarning?: boolean;
}) {
  const { nags } = hooks.useGetUserInfo();
  const showNag = shouldShowNag(nags, Nag.FIRST_BREAKPOINT_ADD);

  if (showWarning) {
    return (
      <div className="static-tooltip-content space-x-2 bg-red-700">
        <MaterialIcon>warning_amber</MaterialIcon>
        <div>{children}</div>
      </div>
    );
  } else if (showNag) {
    return (
      <div className="static-tooltip-content space-x-2" style={{ background: AWESOME_BACKGROUND }}>
        <MaterialIcon iconSize="xl">auto_awesome</MaterialIcon>
        <div className="flex flex-col items-start">
          {!loading ? <div className="font-bold">Click to add a print statement</div> : null}
          <div>{children}</div>
        </div>
      </div>
    );
  }

  return <div className="static-tooltip-content bg-gray-700">{children}</div>;
}

function runAnalysisOnLine(line: number): UIThunkAction {
  return async (dispatch, getState, { ThreadFront }) => {
    // A lot of this logic is reused from logpoint.ts
    // It is possible to instead repurpose that function here, but increasingly
    // I want logpoint.ts to be... for logpoints. Part of what has made our
    // analysis code such a mess is trying to repurpose an analysis runner to
    // work for many different devtools specific workflows. It would be better
    // if many components used the primitives from `protocol` instead. If it
    // turns out that those primitives are getting used the same way all the
    // time, maybe it's time to add some new things to the `protocol` folder.
    const state = getState();
    const source = getSelectedSource(state);

    if (!source) {
      return;
    }

    const location = getFirstBreakpointPosition(getState(), {
      sourceId: source.id,
      sourceUrl: source.url,
      column: undefined,
      line,
    });

    if (!location) {
      return;
    }

    const analysisPoints = selectors.getAnalysisPointsForLocation(getState(), location, undefined);
    if (analysisPoints) {
      return;
    }

    const focusRegion = selectors.getFocusRegion(getState());
    const sessionId = await ThreadFront.waitForSession();
    const params: AnalysisParams = {
      sessionId,
      mapper: "",
      effectful: true,
    };
    if (focusRegion) {
      params.range = {
        begin: (focusRegion as UnsafeFocusRegion).start.point,
        end: (focusRegion as UnsafeFocusRegion).end.point,
      };
    }

    let analysis: Analysis | undefined = undefined;

    try {
      analysis = await createAnalysis(params);
      const { analysisId } = analysis;

      dispatch(analysisCreated({ analysisId, location, condition: undefined }));

      await analysis.addLocation(location);

      dispatch(analysisPointsRequested(analysisId));
      const { points, error } = await analysis.findPoints();

      if (error) {
        dispatch(
          analysisErrored({
            analysisId,
            error: AnalysisError.TooManyPointsToFind,
            points,
          })
        );

        // TODO Remove this and change Redux logic to match
        saveAnalysisError([location], "", AnalysisError.TooManyPointsToFind);

        return;
      }

      dispatch(
        analysisPointsReceived({
          analysisId,
          points,
        })
      );
      dispatch(
        setAnalysisPoints({
          location,
          analysisPoints: points,
        })
      );
    } finally {
      analysis?.releaseAnalysis();
    }
  };
}

export default function LineNumberTooltip({
  editor,
  keyModifiers,
}: {
  editor: any;
  keyModifiers: KeyModifiers;
}) {
  const dispatch = useDispatch();
  const [targetNode, setTargetNode] = useState<HTMLElement | null>(null);
  const lastHoveredLineNumber = useRef<number | null>(null);
  const isMetaActive = keyModifiers.meta;
  const [codeHeatMaps, setCodeHeatMaps] = useState(features.codeHeatMaps);

  const indexed = useSelector(selectors.getIsIndexed);
  const hitCounts = useSelector(getHitCountsForSelectedSource);
  const source = useSelector(getSelectedSource);
  const breakpoints = useSelector(selectors.getBreakpointsList);

  let hits: number | undefined;

  if (lastHoveredLineNumber.current && hitCounts) {
    const lineHitCounts = minBy(
      hitCounts.filter(hitCount => hitCount.location.line === lastHoveredLineNumber.current),
      b => b.location.column
    );
    hits = lineHitCounts?.hits;
  }

  useEffect(() => {
    const setHoveredLineNumber = ({
      lineNumber,
      lineNumberNode,
    }: {
      lineNumber: number;
      lineNumberNode: HTMLElement;
    }) => {
      // The gutter re-renders when we click the line number to add
      // a breakpoint. That triggers a second gutterLineEnter event
      // for the same line number. In that case, we shouldn't run
      // the analysis again.
      if (lineNumber !== lastHoveredLineNumber.current) {
        lastHoveredLineNumber.current = lineNumber;
      }
      setTimeout(() => {
        if (lineNumber === lastHoveredLineNumber.current) {
          dispatch(setBreakpointHitCounts(source!.id, lineNumber, () => {}));
        }
      }, 200);
      dispatch(updateHoveredLineNumber(lineNumber));
      setTargetNode(lineNumberNode);
    };
    const clearHoveredLineNumber = () => {
      setTargetNode(null);
      dispatch(setHoveredLineNumberLocation(null));
    };

    editor.codeMirror.on("lineMouseEnter", setHoveredLineNumber);
    editor.codeMirror.on("lineMouseLeave", clearHoveredLineNumber);
    return () => {
      editor.codeMirror.off("lineMouseEnter", setHoveredLineNumber);
      editor.codeMirror.off("lineMouseLeave", clearHoveredLineNumber);
    };
  }, [codeHeatMaps, dispatch, editor.codeMirror, source]);

  useEffect(() => {
    if (hits) {
      trackEvent(hits ? "breakpoint.preview_has_hits" : "breakpoint.preview_no_hits");
      trackEvent("breakpoint.preview_hits", { hitsCount: hits || null });
    }
  }, [hits]);

  if (
    breakpoints.some(
      b =>
        !b.disabled &&
        b.location.sourceId === source?.id &&
        b.location.line === lastHoveredLineNumber.current
    )
  ) {
    return null;
  }

  if (!targetNode || isMetaActive) {
    return null;
  }

  if (!indexed || hits === undefined) {
    return (
      <StaticTooltip targetNode={targetNode}>
        <Wrapper loading>{!indexed ? "Indexing…" : "Loading…"}</Wrapper>
      </StaticTooltip>
    );
  }

  const text = `${hits} hit${hits == 1 ? "" : "s"}`;
  const showWarning = hits > 200;
  return (
    <StaticTooltip targetNode={targetNode}>
      <Wrapper showWarning={showWarning}>{text}</Wrapper>
    </StaticTooltip>
  );
}
