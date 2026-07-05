import { exportCrownnoteUser } from "../lib/crownnote-export";

async function main() {
  const data = await exportCrownnoteUser(process.argv[2] || "whatthelucas", {
    maxCharts: Number(process.argv[3] || 3),
    onProgress: (p) => console.log("progress", p.current, p.slug, p.entries),
  });

  console.log(
    JSON.stringify(
      {
        username: data.username,
        charts: data.charts.length,
        stats: data.stats,
        first: data.charts[0]?.date,
        last: data.charts.at(-1)?.date,
        sampleEntry: data.charts[0]?.entries[0],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
