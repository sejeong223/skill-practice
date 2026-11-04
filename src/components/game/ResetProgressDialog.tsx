"use client";

import type { ReactElement } from "react";

export interface ResetProgressDialogProps {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly pending?: boolean;
  readonly error?: string | null;
  readonly cloud?: boolean;
}

export function ResetProgressDialog({
  onConfirm,
  onCancel, pending = false, error, cloud = false,
}: ResetProgressDialogProps): ReactElement {
  return (
    <div className="reset-progress-overlay">
      <section
        className="reset-progress-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-progress-title"
        aria-describedby="reset-progress-description"
      >
        <p className="intro-title-kicker">저장 데이터 관리</p>
        <h2 id="reset-progress-title">진행을 초기화할까요?</h2>
        <p id="reset-progress-description">
          {cloud ? "현재 진행·보유품·데스 수를 초기화합니다. 이름과 역대 최고 랭킹 기록은 유지됩니다." : "개발용 진행이 초기화됩니다."}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="reset-progress-actions">
          <button className="tiny-button" type="button" autoFocus disabled={pending || Boolean(error)} onClick={onCancel}>
            취소
          </button>
          <button className="primary-button reset-progress-confirm" type="button" disabled={pending} onClick={onConfirm}>
            {pending ? "초기화 확인 중…" : error ? "초기화 다시 시도" : "초기화"}
          </button>
        </div>
      </section>
    </div>
  );
}
