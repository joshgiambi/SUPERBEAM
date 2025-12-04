# SuperSeg Validation Dataset - BraTS2021_00470_flair

## Overview

This document describes the BraTS FLAIR validation dataset that was converted from NIfTI to DICOM format for testing the SuperSeg tumor segmentation algorithms.

## Dataset Details

### Source
- **Original File**: `superseg/BraTS2021_00470_flair.nii`
- **Dataset**: BraTS 2021 Challenge - Patient 00470 FLAIR sequence
- **Modality**: MR FLAIR (Fluid Attenuated Inversion Recovery)

### Image Properties
- **Dimensions**: 240 × 240 × 155 voxels
- **Voxel Spacing**: 1.0 × 1.0 × 1.0 mm (isotropic)
- **Origin**: (-0.0, -239.0, 0.0)
- **Intensity Range**: 0 to 2767
- **Window Center/Width**: 1383 / 2767

### DICOM Series Information
- **Patient ID**: BRATS470
- **Patient Name**: BRATS_VALIDATION
- **Study Description**: BraTS Validation Study
- **Series Description**: BraTS FLAIR Validation
- **Series Number**: 1
- **Number of Slices**: 155
- **Frame of Reference UID**: 1.2.826.0.1.3680043.8.498.11045.20240101120000.2

## Database Information

### Patient
- **Database ID**: 68
- **Patient ID**: BRATS470
- **Patient Name**: BRATS_VALIDATION
- **Sex**: Other (O)
- **Birth Date**: 1990-01-01

### Study
- **Database ID**: 91
- **Study Instance UID**: 1.2.826.0.1.3680043.8.498.11045.20240101120000.0
- **Study ID**: BRATS470FLAIR
- **Description**: BraTS Validation Study

### Series
- **Database ID**: 3502
- **Series Instance UID**: 1.2.826.0.1.3680043.8.498.11045.20240101120000.1
- **Description**: BraTS FLAIR Validation
- **Modality**: MR
- **Image Count**: 155

### RT Structure Set Series
- **Database ID**: 3503
- **Series Instance UID**: 1.2.826.0.1.3680043.8.498.11045.20240101120000.100
- **Series Description**: RT Structure Set - Blank
- **Modality**: RTSTRUCT
- **Series Number**: 100
- **Referenced Series ID**: 3502 (links to the MR series)
- **Structure Set Label**: BraTS Validation Structures
- **Frame of Reference UID**: 1.2.826.0.1.3680043.8.498.11045.20240101120000.2
- **Status**: Empty (0 structures - ready for contouring)
- **File**: `storage/superseg-validation/RTSTRUCT.dcm` (1.1 KB)

## File Locations

### DICOM Files
- **Directory**: `storage/superseg-validation/`
- **MR Image Files**: 155 DICOM files named `slice_0000.dcm` through `slice_0154.dcm`
- **RT Structure File**: `RTSTRUCT.dcm` (blank structure set)
- **Metadata**: `metadata.json`
- **Total Size**: ~17.7 MB

## Usage

### Accessing in the Viewer
1. Open the CONVERGE Viewer application
2. Navigate to the patient list
3. Look for patient "BRATS_VALIDATION" (Patient ID: BRATS470)
4. Open the "BraTS Validation Study"
5. You should see TWO series:
   - **Series 1**: BraTS FLAIR Validation (155 images, MR)
   - **Series 100**: RT Structure Set - Blank (1 file, RTSTRUCT)

### Testing SuperSeg Algorithm
1. Open the MR series (Series 1: "BraTS FLAIR Validation")
2. The blank RT structure set (Series 100) is automatically associated via Frame of Reference UID
3. Select the RT structure set in the series selector
4. Use the AI Tumor Tool to run SuperSeg segmentation:
   - Click on the tumor region to provide a seed point
   - The SuperSeg model will generate automatic segmentation
   - Results will be saved to the RT structure set
5. The segmentation will create new structures in the RTSTRUCT with proper contours

### Validating Results
- Compare the generated segmentation against known ground truth (if available)
- Evaluate segmentation quality on different slices
- Test edge cases and boundary detection
- Assess performance across the full 3D volume

## Technical Notes

### DICOM Encoding
- **Pixel Data**: 16-bit unsigned integer (uint16)
- **Bits Allocated**: 16
- **Bits Stored**: 16
- **Photometric Interpretation**: MONOCHROME2
- **Transfer Syntax**: Explicit VR Little Endian (1.2.840.10008.1.2.1)
- **SOP Class**: MR Image Storage (1.2.840.10008.5.1.4.1.1.4)

### Intensity Scaling
- Original NIfTI intensities (0-2767) are linearly scaled to uint16 range (0-65535)
- Use `RescaleSlope` and `RescaleIntercept` to recover original values:
  - `RescaleIntercept`: 0.0
  - `RescaleSlope`: 0.04225 (2767/65535)
  - Formula: `OriginalValue = PixelValue * RescaleSlope + RescaleIntercept`

### Coordinate System
- **Image Orientation**: Axial slices (standard orientation: [1, 0, 0, 0, 1, 0])
- **Slice Progression**: Inferior to Superior (z-axis: 0 to 154 mm)
- **Patient Position**: Standard radiology convention

## Conversion Script

The conversion was performed using `convert-nifti-to-dicom.ts`, which:
1. Reads the NIfTI file using SimpleITK
2. Extracts metadata (dimensions, spacing, orientation)
3. Creates proper DICOM files using pydicom
4. Populates the database with patient, study, series, and image records
5. Creates a blank RT structure set ready for contouring

## Next Steps

### For Validation
1. Run SuperSeg segmentation on this dataset
2. Compare results with expected tumor regions
3. Evaluate segmentation quality metrics:
   - Dice coefficient
   - Hausdorff distance
   - Volume overlap
   - Boundary accuracy

### For Development
1. Use this dataset to test algorithm improvements
2. Benchmark performance (speed and accuracy)
3. Test edge cases and failure modes
4. Validate multi-slice consistency

## References

- **BraTS Challenge**: http://www.braintumorsegmentation.org/
- **FLAIR MRI**: Standard brain tumor imaging sequence
- **DICOM Standard**: https://www.dicomstandard.org/
- **NIfTI Format**: https://nifti.nimh.nih.gov/

---

**Created**: October 30, 2025  
**Conversion Script**: `convert-nifti-to-dicom.ts`  
**Status**: ✅ Ready for testing

