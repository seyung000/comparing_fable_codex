# micr
> 동일한 프롬프트를 활용, 각 모델의 구현 차이를 확인하기 위한 코드

Pixel Minecraft MVP를 서로 다른 코딩 에이전트로 각각 구현한 버전을 모아둔 저장소입니다.

- `codex/` — Codex로 생성한 버전 (ES 모듈 기반 Three.js, `styles.css` 별도 분리)
- `claude/` — Claude로 생성한 버전 (전역 Three.js 스크립트, 스타일은 `index.html`에 인라인)

각 폴더는 독립적으로 실행 가능한 완성본입니다. 원하는 버전의 `index.html`을 브라우저에서 열거나 정적 서버로 서빙하면 됩니다.
