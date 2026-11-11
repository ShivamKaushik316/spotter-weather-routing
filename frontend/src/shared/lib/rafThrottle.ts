export interface ThrottledCallback<Arguments extends unknown[]> {
  (...args: Arguments): void;
  cancel: () => void;
}

export function rafThrottle<Arguments extends unknown[]>(
  callback: (...args: Arguments) => void,
): ThrottledCallback<Arguments> {
  let scheduledFrame: number | null = null;
  let latestArguments: Arguments | null = null;

  const throttled = (...args: Arguments) => {
    latestArguments = args;
    if (scheduledFrame !== null) return;
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = null;
      if (latestArguments) callback(...latestArguments);
    });
  };

  throttled.cancel = () => {
    if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = null;
  };

  return throttled;
}
