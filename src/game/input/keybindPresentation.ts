const SPECIAL_KEY_LABELS: Readonly<Record<string, string>> = {
  ArrowLeft: "왼쪽 방향키",
  ArrowRight: "오른쪽 방향키",
  ArrowUp: "위쪽 방향키",
  ArrowDown: "아래쪽 방향키",
  LEFT: "왼쪽 방향키",
  RIGHT: "오른쪽 방향키",
  UP: "위쪽 방향키",
  DOWN: "아래쪽 방향키",
  Space: "스페이스 바",
  SPACE: "스페이스 바",
  Escape: "Esc 키",
  ESC: "Esc 키",
  Enter: "엔터 키",
  Tab: "탭 키",
  Backspace: "백스페이스 키",
  Delete: "삭제 키",
  ShiftLeft: "왼쪽 시프트 키",
  ShiftRight: "오른쪽 시프트 키",
  ControlLeft: "왼쪽 컨트롤 키",
  ControlRight: "오른쪽 컨트롤 키",
  AltLeft: "왼쪽 알트 키",
  AltRight: "오른쪽 알트 키",
  CapsLock: "캡스락 키",
};

export function formatKeybindLabel(keyCode: string): string {
  const specialLabel = SPECIAL_KEY_LABELS[keyCode];
  if (specialLabel) return specialLabel;

  if (/^Key[A-Z]$/.test(keyCode)) {
    return keyCode.slice(3) + " 키";
  }
  if (/^Digit[0-9]$/.test(keyCode)) {
    return keyCode.slice(5) + " 키";
  }
  if (/^Numpad[0-9]$/.test(keyCode)) {
    return "숫자 패드 " + keyCode.slice(6) + " 키";
  }
  if (/^[A-Z]$/.test(keyCode)) {
    return keyCode + " 키";
  }
  if (/^[0-9]$/.test(keyCode)) {
    return keyCode + " 키";
  }
  if (/^F([1-9]|1[0-2])$/.test(keyCode)) {
    return keyCode + " 키";
  }

  const readableKey = keyCode.replace(/^(Key|Digit)/, "");
  return readableKey + " 키";
}
