import React from 'react';
import {
  ProfileImageAdjustModal,
  type ProfileImageAdjustResult,
  type ProfileImageCropParams,
} from '../media/ProfileImageAdjustModal';

export type { ProfileImageAdjustResult, ProfileImageCropParams };

type AspectPreset = { id: string; label: string; ratio: number };

const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'square', label: 'Square', ratio: 1 },
  { id: 'wide', label: 'Wide', ratio: 2 },
  { id: 'x-wide', label: 'Extra wide', ratio: 3 },
  { id: 'tall', label: 'Tall', ratio: 1 / 2 },
];

type BrandLogoCropModalProps = {
  open: boolean;
  /** The image to edit — pass the ORIGINAL (unframed) upload when one is
   *  stored, so re-editing doesn't zoom into an already-framed result. */
  imageSrc: string;
  /** Resume a previous framing against this same original image. */
  initialCrop?: ProfileImageCropParams | null;
  onCancel: () => void;
  /** Normalized logo as a PNG data URL (transparent margins preserved, not matted). */
  onSave: (result: ProfileImageAdjustResult) => void;
};

/**
 * Brand logo framing tool — a thin, Brand-flavored wrapper around the shared
 * ProfileImageAdjustModal (rectangular viewport, seller picks square/wide/
 * tall, transparent-preserving 800px PNG output). Deliberately never a
 * forced 1:1 destructive crop, since logos are naturally square, horizontal
 * (wordmarks), or vertical, unlike a circular avatar.
 */
export function BrandLogoCropModal({ open, imageSrc, initialCrop, onCancel, onSave }: BrandLogoCropModalProps) {
  return (
    <ProfileImageAdjustModal
      open={open}
      imageSrc={imageSrc}
      initialCrop={initialCrop}
      title="Edit brand logo"
      helpText="Frame the useful logo area. Pick a shape, zoom, and drag to reposition — nothing outside the frame is saved."
      shape="rect"
      aspectPresets={ASPECT_PRESETS}
      outputLongSide={800}
      transparentOutput
      accentColor="#FF5B00"
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

export default BrandLogoCropModal;
