import "@/lib/prisma";

async function main() {
  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const igRes = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(igToken)}`);
  console.log("Instagram (graph.instagram.com):", JSON.stringify(await igRes.json(), null, 2));

  const threadsToken = process.env.THREADS_ACCESS_TOKEN!;
  const threadsRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(threadsToken)}`);
  console.log("Threads (graph.threads.net):", JSON.stringify(await threadsRes.json(), null, 2));
}
main().finally(() => process.exit(0));
