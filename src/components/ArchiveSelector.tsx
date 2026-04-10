import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../i18n/I18nProvider";

interface ArchiveSelectorProps {
  archiveRoot: string | null;
  onChooseRoot: (rootPath: string) => Promise<void>;
  loading: boolean;
  errorMessage: string | null;
}

export function ArchiveSelector(props: ArchiveSelectorProps) {
  const { archiveRoot, onChooseRoot, loading, errorMessage } = props;
  const { t } = useI18n();

  async function handleSelectRoot() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("archive.chooseRootTitle"),
    });

    if (typeof selected === "string" && selected.length > 0) {
      await onChooseRoot(selected);
    }
  }

  return (
    <section className="empty-state">
      <div className="empty-card">
        <p className="eyebrow">{t("archive.localArchive")}</p>
        <h1>{t("app.name")}</h1>
        <p>{t("archive.description")}</p>
        <button className="primary-button" onClick={handleSelectRoot} disabled={loading}>
          {loading
            ? t("archive.opening")
            : archiveRoot
              ? t("archive.changeRoot")
              : t("archive.chooseRoot")}
        </button>
        {archiveRoot ? <p className="path-readout">{archiveRoot}</p> : null}
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
