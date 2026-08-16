"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-parts";

// Latitude and longitude.
//
// Phase 5 added a map to /reports, but deliberately NOT a map location picker —
// display-only was the chosen scope. So this remains the only way to set
// coordinates, and it is a complete one rather than a stopgap.
//
// "Use my current location" is the primary action on purpose: the whole premise
// of this app is filing a report while standing next to the problem, usually
// one-handed on a phone. Typing coordinates is the fallback, not the norm.

export function LocationField({
  latitude,
  longitude,
  onChange,
  disabled,
  errors,
}: {
  /** Strings, because a partially-typed number like "23." is not a number yet. */
  latitude: string;
  longitude: string;
  onChange: (next: { latitude: string; longitude: string }) => void;
  disabled?: boolean;
  errors?: { latitude?: string; longitude?: string };
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function useMyLocation() {
    setGeoError(null);

    // Geolocation is not universally available — older browsers, and any page
    // not served over HTTPS or localhost, where browsers disable it outright.
    if (!("geolocation" in navigator)) {
      setGeoError("This browser can't provide your location. Enter it below.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Six decimal places is about 11cm — far beyond what a phone GPS
        // actually knows, but the backend stores a Float and truncating here
        // would be throwing away precision we were handed. The DISPLAY rounds
        // to four (~11m), which is the honest figure to show a person.
        onChange({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      (error) => {
        setLocating(false);

        // Each failure needs a different response from the user, so they get
        // different messages. "Something went wrong" would leave someone who
        // denied permission with no idea that they can change it.
        const messages: Record<number, string> = {
          1: "Location permission was denied. You can allow it in your browser's site settings, or type the coordinates below.",
          2: "Your location isn't available right now. Try again outdoors, or type the coordinates below.",
          3: "Finding your location took too long. Try again, or type the coordinates below.",
        };
        setGeoError(messages[error.code] ?? "Couldn't get your location.");
      },
      {
        // Worth the battery: a report pinned to the wrong street is not much
        // use to whoever has to find the pothole.
        enableHighAccuracy: true,
        timeout: 15_000,
        // Never reuse a cached fix. A stale position from an hour ago could be
        // miles away, and it would be attached to this report as fact.
        maximumAge: 0,
      }
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="docket mb-2">Location</legend>

      <Button
        type="button"
        variant="outline"
        onClick={useMyLocation}
        disabled={disabled || locating}
      >
        {locating ? "Finding you…" : "Use my current location"}
      </Button>

      {geoError && (
        <p role="alert" className="max-w-prose text-sm text-ink-muted">
          {geoError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="latitude"
          label="Latitude"
          // inputMode gives a phone the numeric keypad without the strictness
          // of type="number", which brings scroll-wheel changes and browsers
          // that silently discard a partially-typed value.
          inputMode="decimal"
          placeholder="23.0225"
          value={latitude}
          onChange={(e) => onChange({ latitude: e.target.value, longitude })}
          error={errors?.latitude}
          disabled={disabled}
        />
        <FormField
          id="longitude"
          label="Longitude"
          inputMode="decimal"
          placeholder="72.5714"
          value={longitude}
          onChange={(e) => onChange({ latitude, longitude: e.target.value })}
          error={errors?.longitude}
          disabled={disabled}
        />
      </div>

      {/* Copy corrected in Phase 5: this previously promised a map picker "in
          the next phase". Phase 5 shipped a display-only map and no picker, so
          the promise would have been false. Don't leave interface copy making
          commitments the roadmap has since dropped. */}
      <p className="text-sm text-ink-muted">
        The button above is the quickest way to get this right. You can also
        type coordinates from any map app.
      </p>
    </fieldset>
  );
}
