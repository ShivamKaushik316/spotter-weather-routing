import { RiskBadge, riskDefinition } from "@/entities/risk";
import { findRoute } from "@/entities/route";
import { useTripPlan } from "@/entities/trip";
import type { WeatherConditions } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatMiles, formatTimeZoneName } from "@/shared/lib/format";
import { CloseIcon } from "@/shared/ui/icons";
import { Panel } from "@/shared/ui/Panel";
import { useSelectionStore } from "@/stores/selectionStore";

const MILLISECONDS_PER_HOUR = 3_600_000;

const WEATHER_READINGS: readonly {
  caption: string;
  unit: string;
  decimals: number;
  read: (weather: WeatherConditions) => number;
}[] = [
  { caption: "Wind", unit: "mph", decimals: 1, read: (weather) => weather.wind_speed_mph },
  { caption: "Gust", unit: "mph", decimals: 1, read: (weather) => weather.wind_gust_mph },
  { caption: "Rain", unit: "in/hr", decimals: 2, read: (weather) => weather.rain_inches_per_hour },
  {
    caption: "Snow",
    unit: "in/hr",
    decimals: 2,
    read: (weather) => weather.snowfall_inches_per_hour,
  },
];

export function CheckpointDrawer() {
  const { data: plan } = useTripPlan();
  const selection = useSelectionStore((state) => state.selectedCheckpoint);
  const closeCheckpoint = useSelectionStore((state) => state.closeCheckpoint);
  const route = findRoute(plan, selection?.routeId ?? null);
  const checkpoint = route?.checkpoints.find(
    (candidate) => candidate.sequence === selection?.sequence,
  );
  const isOpen = Boolean(plan && route && checkpoint);

  const arrival = checkpoint ? new Date(checkpoint.estimated_arrival) : null;
  const hoursAfterDeparture =
    plan && arrival ? (arrival.getTime() - Date.parse(plan.departure)) / MILLISECONDS_PER_HOUR : 0;
  const levelColor = riskDefinition(checkpoint?.risk_level).color;
  const weather = checkpoint?.weather ?? null;

  return (
    <Panel
      as="aside"
      aria-label="Checkpoint details"
      aria-hidden={!isOpen}
      className={cn(
        "drawer absolute right-4 top-[72px] w-[316px] p-4 transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+24px)]",
      )}
    >
      {route && checkpoint && arrival && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-bold">
                Route {route.route_id} · Checkpoint {checkpoint.sequence + 1}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-muted">
                mile {formatMiles(checkpoint.distance_from_origin_miles)} · ETA{" "}
                {formatDateTime(arrival)} {formatTimeZoneName(arrival)} (+
                {hoursAfterDeparture.toFixed(1)} h)
              </p>
            </div>
            <button
              type="button"
              onClick={closeCheckpoint}
              aria-label="Close checkpoint details"
              aria-keyshortcuts="Escape"
              className="text-muted hover:text-ink"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <RiskBadge level={checkpoint.risk_level} className="mt-3" />

          {weather ? (
            <dl className="mt-3.5 grid grid-cols-2 gap-2">
              {WEATHER_READINGS.map((reading) => (
                <div
                  key={reading.caption}
                  className="flex flex-col-reverse rounded-[10px] border border-line bg-raised p-2.5"
                >
                  <dt className="text-[10px] uppercase tracking-wide text-muted">
                    {reading.caption}
                  </dt>
                  <dd className="font-mono text-base font-semibold tabular-nums">
                    {reading.read(weather).toFixed(reading.decimals)}{" "}
                    <span className="text-[11px] font-medium text-muted">{reading.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3.5 text-xs text-muted">
              No forecast is available for this place and time.
            </p>
          )}

          <ul className="mt-3.5 flex flex-col gap-1.5" aria-label="Why this risk level">
            {checkpoint.risk_reasons.map((reason) => (
              <li
                key={reason}
                className="rounded-lg border-l-[3px] bg-raised px-2.5 py-2 text-xs"
                style={{ borderLeftColor: levelColor }}
              >
                {reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
