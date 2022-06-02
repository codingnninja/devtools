import { orderBy } from "lodash";
import { MouseEvent, useContext } from "react";
import MaterialIcon from "ui/components/shared/MaterialIcon";
import { Recording, SourceMetadata } from "ui/types";
import { getFormattedTime } from "ui/utils/timeline";
import { getRelativeDate } from "../RecordingRow";
import { LibraryContext } from "../useFilters";

export function ReplayRows({ recordings }: { recordings: Recording[] }) {
  return (
    <div className="flex flex-col space-y-1">
      {orderBy(recordings, "date", "desc").map((r, i) => (
        <ReplayRow recording={r} key={i} />
      ))}
    </div>
  );
}

function PullRequestDetails({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex space-x-1 items-center text-gray-500">
      <MaterialIcon>merge</MaterialIcon>
      <span>{title}</span>
      <span>#{id}</span>
    </div>
  );
}

function CommitDetails({ source }: { source?: SourceMetadata }) {
  const title = source?.commit.title || "Unknown commit message";
  const id = source?.commit.id ? source.commit.id.substring(0, 7) : "Unknown ID";

  return (
    <div className="flex space-x-1">
      <span className="font-medium">{title}</span>
      <span className="overflow-hidden overflow-ellipsis whitespace-pre">({id})</span>
    </div>
  );
}

function ReplayRow({ recording }: { recording: Recording }) {
  const { setView, setAppliedText } = useContext(LibraryContext);
  const { metadata, date, duration } = recording;

  const onViewTestRun = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setView("recordings");
    setAppliedText(`test-run:${metadata.test!.run!.id}`);
  };

  return (
    <a href={`/recording/${recording.id}`} target="_blank" rel="noreferrer noopener">
      <div className="flex flex-row items-center space-x-2 hover:bg-gray-100 px-3 p-2 rounded-md flex-grow">
        <ResultIcon result={metadata.test?.result} />
        <div className="flex flex-col flex-grow">
          <CommitDetails source={metadata.source} />
          {metadata.source?.merge ? (
            <PullRequestDetails id={metadata.source.merge.id} title={metadata.source.merge.title} />
          ) : null}
          <div className="flex space-x-3 items-center text-gray-500">
            <div className="flex space-x-1 items-center">
              <MaterialIcon>fork_right</MaterialIcon>
              <span>{metadata.source?.branch || "Unknown branch"}</span>
            </div>
            <div className="flex space-x-1 items-center">
              <MaterialIcon>schedule</MaterialIcon>
              <span>{getRelativeDate(date)}</span>
            </div>
            <div className="flex space-x-1 items-center">
              <MaterialIcon>timer</MaterialIcon>
              <span>{getFormattedTime(duration)}</span>
            </div>
          </div>
          <div className="flex pt-1 space-x-1">
            <span className="hover:underline">Open Replay</span>
            <span>|</span>
            {metadata.test?.run?.id ? (
              <button onClick={onViewTestRun} className="hover:underline">
                View Test Run ({metadata.test.run.id.slice(0, 7)})
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </a>
  );
}

function ResultIcon({ result }: { result?: "passed" | "failed" | "timedOut" }) {
  if (result === "passed") {
    return (
      <MaterialIcon className="text-green-500" iconSize="xl">
        check_circle
      </MaterialIcon>
    );
  } else if (result === "failed") {
    return (
      <MaterialIcon className="text-red-500" iconSize="xl">
        error
      </MaterialIcon>
    );
  } else if (result === "timedOut") {
    // TODO: Add a timeout icon
    return null;
  }

  return null;
}
