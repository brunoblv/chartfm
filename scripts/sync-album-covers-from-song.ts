/**
 * @deprecated As capas não são mais armazenadas em Song; use apenas `Album.coverUrl`.
 * Se ainda tiver dados legados, aplique uma migração SQL única ou preencha álbuns via Spotify/admin.
 */
async function main() {
  console.log("Descontinuado: Song não tem mais cover_image_url. Mantido só para não quebrar chamadas antigas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
