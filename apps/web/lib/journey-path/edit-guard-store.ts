export type JourneyEditGuardController = {
  shouldConfirmLeave: () => boolean;
  promptLeave: (href: string) => Promise<boolean>;
};

let controller: JourneyEditGuardController | null = null;

export function registerJourneyEditGuard(next: JourneyEditGuardController | null) {
  controller = next;
}

export async function requestJourneyEditLeave(href: string): Promise<boolean> {
  if (!controller?.shouldConfirmLeave()) return true;
  return controller.promptLeave(href);
}
