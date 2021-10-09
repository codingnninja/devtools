import React from "react";
import { Workspace } from "ui/types";
import { TrialEnd } from "../shared/TrialEnd";

export function UploadRecordingTrialEnd({
  workspaces,
  selectedWorkspaceId,
}: {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
}) {
  const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
  // Need to assign a 0px top margin here so it doesn't get affected by the
  // parent's space-y styling
  const style = { marginTop: "0px" };

  if (!workspace?.subscription?.trialEnds) {
    return null;
  }

  return (
    <div className="absolute top-0 left-1/2 transform -translate-x-1/2" {...{ style }}>
      <TrialEnd trialEnds={workspace.subscription.trialEnds} />
    </div>
  );
}