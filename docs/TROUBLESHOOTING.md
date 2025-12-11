# html2md 문제 해결 가이드

## 해결된 문제들

### ✅ 문제 1: "Error: [object Object]" 에러
**원인:** Content script가 주입되지 않은 페이지에서 메시지를 보내려고 시도

**해결:**
- `scripting` 권한을 manifest.json에 추가
- popup.js와 background.js에서 동적 스크립트 주입 구현
- 에러 처리 개선 및 사용자 친화적인 알림 추가

### ✅ 문제 2: 영역 선택이 안되는 문제
**원인:** Content script가 페이지에 주입되지 않음

**해결:**
- 동적 스크립트 주입 기능 추가
- 중복 주입 방지 로직 추가
- 자동으로 스크립트를 주입한 후 선택 모드 활성화

## 설치 및 테스트 방법

### 1. Extension 재설치

문제를 해결했으므로 Extension을 **다시 로드**해야 합니다:

1. `chrome://extensions/` 페이지로 이동
2. html2md Extension 카드에서 **"새로고침"** 버튼 (🔄) 클릭
3. 또는 Extension을 제거하고 다시 "압축해제된 확장 프로그램을 로드합니다"

### 2. 테스트 방법

#### A. 새로운 탭에서 테스트
1. 새 탭 열기
2. 테스트 사이트로 이동 (예: https://developer.mozilla.org)
3. html2md 아이콘 클릭 또는 `Cmd+Shift+M` 단축키
4. 상단에 안내 바가 나타나야 함
5. 마우스로 요소에 호버하면 파란색 하이라이트 표시
6. 클릭해서 선택

#### B. 이미 열린 탭에서 테스트
1. 이미 열려있는 웹페이지에서도 작동해야 함
2. html2md 아이콘 클릭
3. 처음 클릭 시 스크립트가 자동으로 주입됨
4. 선택 모드 활성화

### 3. 작동 확인 체크리스트

- [ ] Extension 아이콘 클릭 시 팝업이 나타남
- [ ] "선택 모드 시작" 버튼 클릭 시 팝업이 닫히고 선택 모드 활성화
- [ ] 상단에 검은색 안내 바가 표시됨
- [ ] 마우스 호버 시 요소에 파란색 점선 테두리
- [ ] 클릭 시 파란색 실선 테두리로 변경
- [ ] 선택 후 팝업(복사/다운로드 버튼)이 나타남
- [ ] 복사 버튼 클릭 시 "복사되었습니다" 토스트
- [ ] 다운로드 버튼 클릭 시 .md 파일 다운로드
- [ ] ESC 키로 선택 모드 종료

## 알려진 제약사항

### 작동하지 않는 페이지
- `chrome://` 페이지 (Chrome 설정, Extensions 등)
- `chrome-extension://` 페이지
- Chrome Web Store 페이지
- 일부 보안이 강화된 페이지

이런 페이지에서는 알림이 표시됩니다:
> "이 페이지에서는 확장 프로그램을 사용할 수 없습니다. 일반 웹페이지에서 시도해주세요."

### 추천 테스트 사이트
✅ 잘 작동하는 사이트들:
- https://developer.mozilla.org (MDN)
- https://react.dev (React Docs)
- https://github.com (GitHub)
- https://stackoverflow.com (Stack Overflow)
- https://www.wikipedia.org (Wikipedia)
- 일반 블로그 및 문서 사이트

## 디버깅 방법

### Chrome DevTools 사용

1. **Console 확인**
   - 페이지에서 F12 눌러 DevTools 열기
   - Console 탭에서 에러 메시지 확인
   - `html2md content script loaded` 메시지가 보여야 함

2. **Extension 에러 확인**
   - `chrome://extensions/` 페이지로 이동
   - html2md Extension 카드에서 "오류" 버튼 확인
   - Service Worker 링크 클릭하여 background script 로그 확인

3. **네트워크 확인**
   - DevTools의 Network 탭
   - Turndown.js 라이브러리가 로드되는지 확인

### 자주 묻는 질문

**Q: 아이콘을 클릭했는데 아무 일도 일어나지 않아요**
A: 페이지를 새로고침하거나, Extension을 다시 로드한 후 시도하세요.

**Q: 선택은 되는데 복사가 안돼요**
A: 브라우저가 클립보드 권한을 차단했을 수 있습니다. 페이지 URL 옆의 자물쇠 아이콘에서 권한을 확인하세요.

**Q: 마크다운 변환 결과가 이상해요**
A: 사이트마다 HTML 구조가 다릅니다. `Shift+↑/↓`로 선택 범위를 조절하거나, 더 작은 단위로 선택해보세요.

**Q: 단축키가 작동하지 않아요**
A:
- Chrome 설정에서 다른 Extension과 충돌하는지 확인
- `chrome://extensions/shortcuts`에서 단축키 설정 확인

## 피드백 및 버그 리포트

문제가 계속되면:
1. Chrome Console의 에러 메시지 복사
2. 문제가 발생한 웹사이트 URL
3. 재현 단계
를 포함해서 리포트해주세요.

## 다음 단계

Extension이 정상 작동하면:
- 실제 업무에서 문서를 마크다운으로 변환해보세요
- 다양한 웹사이트에서 테스트해보세요
- 불편한 점이나 개선 아이디어를 기록하세요
