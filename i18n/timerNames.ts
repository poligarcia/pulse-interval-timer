import type { AppMessages } from './messages.ts';

export type LocalizableTimerName = {
  name: string;
  nameIsCustom?: boolean;
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
};

export function localizeTimerName(timer: LocalizableTimerName, copy: AppMessages) {
  return timer.nameIsCustom === false
    ? copy.timerDetails.automaticName(timer.work, timer.rest, timer.rounds, timer.cycles)
    : timer.name;
}
