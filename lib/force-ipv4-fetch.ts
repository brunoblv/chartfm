/**
 * Força IPv4 no fetch nativo (undici) via dispatcher global.
 *
 * dns.setDefaultResultOrder("ipv4first") não é suficiente: o dispatcher padrão
 * do undici já resolve DNS por conta própria em alguns caminhos e ignora essa
 * config dependendo de quando é chamada (import order, next dev, tsx scripts
 * fora do register() do Next). Setar o dispatcher global com family:4 força
 * IPv4 em toda chamada fetch(), não só na primeira definida no processo.
 * Sem isso, redes com IPv6 mal configurado (comum em fibra residencial no
 * Brasil) fazem fetch para hosts com AAAA (ex.: musicbrainz.org) travar com
 * "fetch failed".
 */
import { Agent, buildConnector, setGlobalDispatcher } from "undici";

let applied = false;

export function forceIpv4Fetch(): void {
  if (applied) return;
  applied = true;
  setGlobalDispatcher(
    new Agent({ connect: buildConnector({ family: 4 } as buildConnector.BuildOptions) }),
  );
}

forceIpv4Fetch();
