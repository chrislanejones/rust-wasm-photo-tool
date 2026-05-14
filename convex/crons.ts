import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Delete anonymous session edits that haven't been touched in 3 days.
crons.daily(
  "expire session edits",
  { hourUTC: 3, minuteUTC: 0 },
  internal.photoEdits.expireSessionEdits,
);

export default crons;
