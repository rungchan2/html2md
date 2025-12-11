좋은 질문이에요. 기술적으로 검토해볼 부분들을 정리해볼게요.

## 1. HTML to Markdown 변환

### 외부 패키지 필요 여부

**Turndown.js 사용 추천** - 직접 구현하는 것보다 훨씬 안정적입니다.

```javascript
// Turndown.js 사용 예시
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});
turndown.use(gfm); // 테이블, 취소선 지원

const markdown = turndown.turndown(selectedElement.innerHTML);
```

**직접 구현 시 문제점:**
- 중첩된 리스트 처리가 복잡함
- 테이블 변환 로직이 까다로움
- 엣지 케이스가 너무 많음 (빈 태그, 깨진 HTML 등)

**Turndown.js 장점:**
- 8KB gzipped로 가벼움
- 커스텀 룰 추가 가능
- 잘 관리되는 라이브러리

---

## 2. 주요 기술적 챌린지

### 2.1 DOM 요소 선택 정확도

**문제:** 사이트마다 DOM 구조가 천차만별

```html
<!-- 어떤 사이트 -->
<article>
  <section>내용</section>
</article>

<!-- 다른 사이트 -->
<div class="content">
  <div class="post-body">
    <div class="paragraph">내용</div>
  </div>
</div>
```

**해결 방안:**
- `Shift+↑↓`로 범위 조절 기능 (이미 PRD에 포함)
- 의미있는 블록 요소 우선 감지: `article`, `section`, `main`, `pre`, `table`, `ul`, `ol`, `blockquote` 등

---

### 2.2 코드블록 언어 감지

**문제:** 언어 정보가 다양한 방식으로 표현됨

```html
<!-- 방식 1: class -->
<pre><code class="language-python">...</code></pre>

<!-- 방식 2: data 속성 -->
<pre data-lang="javascript">...</pre>

<!-- 방식 3: 하이라이터별 -->
<pre class="highlight python">...</pre>
<div class="prism-code language-tsx">...</div>
```

**해결 방안:**
```javascript
function detectLanguage(element) {
  // 1. class에서 language- 또는 lang- 찾기
  const classMatch = element.className.match(/(?:language-|lang-)(\w+)/);
  if (classMatch) return classMatch[1];
  
  // 2. data 속성 확인
  const dataLang = element.dataset.lang || element.dataset.language;
  if (dataLang) return dataLang;
  
  // 3. 부모 요소까지 탐색
  // ...
  
  return ''; // 감지 실패 시 빈 문자열
}
```

---

### 2.3 스타일 충돌

**문제:** 우리가 주입하는 CSS가 사이트 CSS와 충돌

```css
/* 우리 스타일 */
.mg-highlight { outline: 2px solid blue; }

/* 사이트가 덮어쓸 수 있음 */
* { outline: none !important; }
```

**해결 방안:**
- Shadow DOM 사용 (안내 바, 팝업 등 UI 요소에)
- 매우 구체적인 선택자 + `!important`
- 인라인 스타일 사용

```javascript
// Shadow DOM으로 UI 격리
const container = document.createElement('div');
const shadow = container.attachShadow({ mode: 'closed' });
shadow.innerHTML = `
  <style>/* 격리된 스타일 */</style>
  <div class="toolbar">...</div>
`;
```

---

### 2.4 iframe 내부 콘텐츠

**문제:** 일부 사이트는 콘텐츠가 iframe 안에 있음

**해결 방안:**
- 동일 출처(same-origin) iframe만 접근 가능
- cross-origin iframe은 기술적으로 접근 불가 (보안 제한)
- v1에서는 스코프 아웃, 추후 고려

---

### 2.5 동적 로딩 콘텐츠

**문제:** SPA에서 페이지 이동 시 content script가 재실행 안 됨

**해결 방안:**
```javascript
// URL 변경 감지
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // 상태 리셋
  }
}).observe(document, { subtree: true, childList: true });
```

---

### 2.6 특수 사이트 처리

**문제:** 주요 문서 사이트들의 특이한 구조

| 사이트 | 특이사항 |
|--------|----------|
| GitHub | 마크다운 이미 렌더링됨, 코드블록 구조 복잡 |
| MDN | 다국어, 탭 구조 |
| React Docs | RSC로 빌드, 인터랙티브 예제 |
| Notion | 자체 블록 구조, 복잡한 중첩 |

**해결 방안:**
- 사이트별 커스텀 룰 추가 가능하도록 설계
- Turndown의 `addRule` 기능 활용

```javascript
turndown.addRule('githubCode', {
  filter: (node) => node.matches('.highlight pre'),
  replacement: (content, node) => {
    const lang = detectGitHubLang(node);
    return `\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
  }
});
```

---

## 3. 난이도 평가

| 기능 | 난이도 | 이유 |
|------|--------|------|
| 기본 선택 모드 | ⭐⭐ | 이벤트 핸들링만 잘하면 됨 |
| 하이라이트 UI | ⭐⭐ | CSS 충돌 주의 필요 |
| HTML→MD 변환 | ⭐ | Turndown 사용하면 쉬움 |
| 코드 언어 감지 | ⭐⭐⭐ | 사이트별 분기 많음 |
| 부모/자식 범위 조절 | ⭐⭐ | DOM 트리 탐색 로직 |
| 다중 선택 병합 | ⭐⭐⭐ | 순서 보장, 중복 제거 |
| 복사/다운로드 | ⭐ | 브라우저 API 사용 |

---

## 4. 결론

**외부 패키지:** Turndown.js 사용 권장 (직접 구현 대비 시간 90% 절약)

**가장 큰 챌린지:**
1. 사이트별 DOM 구조 대응
2. 코드블록 언어 감지 정확도
3. CSS 충돌 방지

**MVP 전략:**
- v1: 기본 기능 + 주요 문서 사이트(MDN, GitHub, React Docs) 최적화
- v2: 사용자 피드백 기반으로 사이트별 룰 추가

바로 개발 시작할까요?