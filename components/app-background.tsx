/**
 * Parede de fundo — position:absolute dentro do body (100lvh).
 * NÃO usa position:fixed (no iOS o fixed salta com o visualViewport/teclado).
 * NÃO usa window.innerHeight (encurtava ~1cm e deixava gap preto).
 */
import { NeumaBackgroundWall } from "@/components/neuma-background-wall";

export function AppBackground() {
  return <NeumaBackgroundWall />;
}
