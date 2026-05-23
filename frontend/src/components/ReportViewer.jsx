import React from 'react';
import ReportOutput from './ReportOutput';

/**
 * ReportViewer component (wrapper for backward compatibility).
 * Props:
 *  - markdown: string
 *  - reportId: string | null
 *  - title: string
 *  - displayId: string
 *  - patientName: string
 *  - moduleType: string
 *  - onSaveToCasebook: function
 */
export default function ReportViewer({
  markdown,
  reportId,
  title,
  displayId,
  patientName,
  moduleType,
  onSaveToCasebook
}) {
  return (
    <ReportOutput
      markdown={markdown}
      reportId={reportId}
      displayId={displayId || title || "Report"}
      patientName={patientName || ""}
      moduleType={moduleType || "cbc"}
      onSaveToCasebook={onSaveToCasebook}
    />
  );
}
