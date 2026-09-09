import React from 'react';
import {
  ProfileImageAdjustModal,
  type ProfileImageAdjustResult,
  type ProfileImageCropParams,
} from '../media/ProfileImageAdjustModal';

export type { ProfileImageAdjustResult, ProfileImageCropParams };

type AvatarCropModalProps = {
  open: boolean;
  /** The image to edit — pass the ORIGINAL (uncropped) upload when one is
   *  stored, so re-editing doesn't zoom into an already-cropped result. */
  imageSrc: string;
  /** Resume a previous adjustment against this same original image. */
  initialCrop?: ProfileImageCropParams | null;
  onCancel: () => void;
  onSave: (result: ProfileImageAdjustResult) => void;
};

/**
 * Personal profile-photo cropper — a thin, User-Profile-flavored wrapper
 * around the shared ProfileImageAdjustModal (circular frame, 256px PNG
 * output). Brand Studio's logo framing and Creator Studio's avatar framing
 * use the same underlying component; this file only fixes the shape/labels
 * for the personal-avatar case so none of its three existing call sites
 * (UserProfileDropdown, PersonalAvatarCard) had to change their UI copy.
 */
export function AvatarCropModal({ open, imageSrc, initialCrop, onCancel, onSave }: AvatarCropModalProps) {
  return (
    <ProfileImageAdjustModal
      open={open}
      imageSrc={imageSrc}
      initialCrop={initialCrop}
      title="Edit profile photo"
      helpText="Drag to reposition. Zoom in/out or use the slider."
      shape="circle"
      outputLongSide={256}
      transparentOutput={false}
      accentColor="#EF3C23"
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

export default AvatarCropModal;
