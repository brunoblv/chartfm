-- Rastreia, por registro, quais fontes (spotify/lastfm/musicbrainz/wikipedia) já foram
-- consultadas sem retorno — evita repetir a mesma busca sem resultado a cada novo backfill.
ALTER TABLE "Song" ADD COLUMN "sources_not_found" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "albums" ADD COLUMN "sources_not_found" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "artists" ADD COLUMN "sources_not_found" TEXT[] NOT NULL DEFAULT '{}';
