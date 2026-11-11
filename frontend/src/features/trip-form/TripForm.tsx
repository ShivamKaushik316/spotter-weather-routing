import { useId, type FormEvent } from "react";
import type { Place, SamplingInterval } from "@/shared/api/types";
import { SAMPLING_INTERVALS } from "@/shared/api/types";
import { Chip } from "@/shared/ui/Chip";
import { CrosshairIcon, SwapIcon } from "@/shared/ui/icons";
import { SectionLabel } from "@/shared/ui/SectionLabel";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { useTripDraftStore, type EndpointRole } from "@/stores/tripDraftStore";
import { DepartureField } from "./DepartureField";
import { FieldError } from "./FieldError";
import { LoadField } from "./LoadField";
import { PlaceSearchField } from "./PlaceSearchField";
import { SAMPLE_TRIPS } from "./sampleTrips";
import { TRIP_FORM_ID } from "./tripFormId";
import { useSubmitTrip } from "./useSubmitTrip";

const INTERVAL_OPTIONS = SAMPLING_INTERVALS.map((miles) => ({
  value: miles,
  label: `${miles} mi`,
}));

export function TripForm() {
  const originErrorId = useId();
  const destinationErrorId = useId();
  const { errors, submit, clearError } = useSubmitTrip();
  const origin = useTripDraftStore((state) => state.origin);
  const destination = useTripDraftStore((state) => state.destination);
  const departure = useTripDraftStore((state) => state.departure);
  const loadPounds = useTripDraftStore((state) => state.loadPounds);
  const intervalMiles = useTripDraftStore((state) => state.intervalMiles);
  const nextMapPick = useTripDraftStore((state) => state.nextMapPick);
  const setEndpoint = useTripDraftStore((state) => state.setEndpoint);
  const swapEndpoints = useTripDraftStore((state) => state.swapEndpoints);
  const setDeparture = useTripDraftStore((state) => state.setDeparture);
  const setLoadPounds = useTripDraftStore((state) => state.setLoadPounds);
  const setIntervalMiles = useTripDraftStore((state) => state.setIntervalMiles);
  const applyDraft = useTripDraftStore((state) => state.applyDraft);

  const selectEndpoint = (role: EndpointRole) => (place: Place | null) => {
    setEndpoint(role, place);
    clearError(role);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const loadSampleTrip = (origin: Place, destination: Place) => {
    applyDraft({ origin, destination });
    clearError("origin");
    clearError("destination");
    submit();
  };

  return (
    <form
      id={TRIP_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-[18px]"
      aria-label="Plan a trip"
    >
      <section>
        <SectionLabel>Trip</SectionLabel>
        <div className="relative flex flex-col gap-1.5">
          <PlaceSearchField
            endpoint="origin"
            label="Origin"
            value={origin}
            onSelect={selectEndpoint("origin")}
            isNextMapPick={nextMapPick === "origin"}
            hasError={Boolean(errors.origin)}
            errorId={originErrorId}
          />
          <PlaceSearchField
            endpoint="destination"
            label="Destination"
            value={destination}
            onSelect={selectEndpoint("destination")}
            isNextMapPick={nextMapPick === "destination"}
            hasError={Boolean(errors.destination)}
            errorId={destinationErrorId}
          />
          <button
            type="button"
            onClick={swapEndpoints}
            aria-label="Swap origin and destination"
            className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg border border-line-strong bg-panel text-muted hover:text-ink"
          >
            <SwapIcon size={14} />
          </button>
        </div>
        <FieldError id={originErrorId} message={errors.origin} />
        <FieldError id={destinationErrorId} message={errors.destination} />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <CrosshairIcon size={13} />
          or click the map to drop the {nextMapPick}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Sample trips">
          {SAMPLE_TRIPS.map((sample) => (
            <Chip
              key={sample.name}
              isActive={
                origin?.label === sample.origin.label &&
                destination?.label === sample.destination.label
              }
              onClick={() => loadSampleTrip(sample.origin, sample.destination)}
            >
              {sample.name}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <DepartureField
          departure={departure}
          onChange={(nextDeparture) => {
            setDeparture(nextDeparture);
            clearError("departure");
          }}
          error={errors.departure}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">Sample weather every</span>
          <SegmentedControl<SamplingInterval>
            ariaLabel="Weather sampling interval"
            options={INTERVAL_OPTIONS}
            value={intervalMiles}
            onChange={setIntervalMiles}
            className="w-[186px]"
          />
        </div>
      </section>

      <LoadField loadPounds={loadPounds} onChange={setLoadPounds} />
    </form>
  );
}
