"use client";

import type { ReactElement } from "react";

export interface ResetProgressDialogProps {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ResetProgressDialog({
  onConfirm,
  onCancel,
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
          저장된 진행이 모두 초기화됩니다. 그래도 계속하시겠습니까?
        </p>
        <div className="reset-progress-actions">
          <button className="tiny-button" type="button" autoFocus onClick={onCancel}>
            취소
          </button>
          <button className="primary-button reset-progress-confirm" type="button" onClick={onConfirm}>
            초기화
          </button>
        </div>
      </section>
    </div>
  );
}
