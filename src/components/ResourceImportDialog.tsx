import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

type ImportMode = "resource_only" | "resource_and_extract";
type ExistingTranscriptionMode = "replace" | "append" | "cancel";

export interface ResourceImportDialogResult {
  importMode: ImportMode;
  existingTranscriptionMode: ExistingTranscriptionMode;
}

interface ResourceImportDialogProps {
  openState: boolean;
  fileName: string;
  supportsExtraction: boolean;
  hasExistingTranscription: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (result: ResourceImportDialogResult) => Promise<void>;
}

export function ResourceImportDialog(props: ResourceImportDialogProps) {
  const { t } = useI18n();
  const { openState, fileName, supportsExtraction, hasExistingTranscription, submitting, onClose, onSubmit } =
    props;
  const [importMode, setImportMode] = useState<ImportMode>("resource_only");
  const [existingTranscriptionMode, setExistingTranscriptionMode] = useState<ExistingTranscriptionMode>("replace");

  useEffect(() => {
    if (!openState) {
      return;
    }
    setImportMode("resource_only");
    setExistingTranscriptionMode("replace");
  }, [fileName, openState]);

  const showExistingTranscriptionChoices = useMemo(() => {
    return supportsExtraction && hasExistingTranscription && importMode === "resource_and_extract";
  }, [hasExistingTranscription, importMode, supportsExtraction]);

  if (!openState) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-narrow">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t("editor.resources")}</p>
            <h2>{t("prompt.importExtract")}</h2>
          </div>
          <button className="ghost-button" onClick={onClose} disabled={submitting}>
            {t("common.close")}
          </button>
        </div>

        <div className="editor-section">
          <div className="path-readout">{fileName}</div>

          <label className="option-card">
            <input
              type="radio"
              name="resource-import-mode"
              checked={importMode === "resource_only"}
              onChange={() => setImportMode("resource_only")}
            />
            <span>{t("option.saveResourceOnly")}</span>
          </label>

          <label className={`option-card ${!supportsExtraction ? "is-disabled" : ""}`}>
            <input
              type="radio"
              name="resource-import-mode"
              checked={importMode === "resource_and_extract"}
              onChange={() => setImportMode("resource_and_extract")}
              disabled={!supportsExtraction}
            />
            <span>{t("option.saveResourceAndExtract")}</span>
          </label>

          {!supportsExtraction ? <p className="hint-text">{t("notice.extractionUnsupported")}</p> : null}
        </div>

        {showExistingTranscriptionChoices ? (
          <div className="editor-section">
            <h3 className="dialog-subtitle">{t("prompt.transcriptionExists")}</h3>

            <label className="option-card">
              <input
                type="radio"
                name="existing-transcription-mode"
                checked={existingTranscriptionMode === "replace"}
                onChange={() => setExistingTranscriptionMode("replace")}
              />
              <span>{t("option.replaceTranscription")}</span>
            </label>

            <label className="option-card">
              <input
                type="radio"
                name="existing-transcription-mode"
                checked={existingTranscriptionMode === "append"}
                onChange={() => setExistingTranscriptionMode("append")}
              />
              <span>{t("option.appendTranscription")}</span>
            </label>

            <label className="option-card">
              <input
                type="radio"
                name="existing-transcription-mode"
                checked={existingTranscriptionMode === "cancel"}
                onChange={() => setExistingTranscriptionMode("cancel")}
              />
              <span>{t("option.cancelInsertion")}</span>
            </label>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => void onSubmit({ importMode, existingTranscriptionMode })}
          >
            {submitting ? t("button.importing") : t("button.importResource")}
          </button>
        </div>
      </div>
    </div>
  );
}
