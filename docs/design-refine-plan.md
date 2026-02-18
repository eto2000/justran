# Justran 디자인 리파인 계획 - 미니멀 다크

## Context
Justran은 러닝 기록 이미지를 배경에 합성하는 React PWA 앱입니다.
현재 라이트 테마의 기본적인 디자인을 **미니멀 다크 (Figma/Notion 스타일)**로 세련되게 개선합니다.
기능 변경 없이 CSS/스타일만 수정합니다.

---

## 새 컬러 팔레트

| 용도 | 변수 | 값 |
|------|------|-----|
| 앱 배경 | `--bg-base` | `#1a1a1e` |
| 카드/패널 | `--bg-elevated` | `#232328` |
| 컨트롤 배경 | `--bg-surface` | `#2a2a30` |
| 호버 | `--bg-hover` | `#35353d` |
| 테두리(약) | `--border-subtle` | `rgba(255,255,255,0.08)` |
| 테두리(중) | `--border-default` | `rgba(255,255,255,0.12)` |
| 테두리(강) | `--border-strong` | `rgba(255,255,255,0.20)` |
| 기본 텍스트 | `--text-primary` | `rgba(255,255,255,0.92)` |
| 보조 텍스트 | `--text-secondary` | `rgba(255,255,255,0.60)` |
| 힌트 텍스트 | `--text-tertiary` | `rgba(255,255,255,0.40)` |
| 액센트 | `--accent` | `#5b9bd5` |
| 액센트 호버 | `--accent-hover` | `#4a8ac4` |
| 액센트 배경 | `--accent-subtle` | `rgba(91,155,213,0.15)` |

---

## 수정 파일 및 작업 내용

### 1. src/styles/index.css (핵심 - 작업의 85%)

- `:root` CSS 변수 전체 교체 (새 다크 팔레트)
- `body` 배경/텍스트 색상 다크 적용
- `.app-container` max-width 720px로 축소 (Notion식 포커스 레이아웃)
- `header`, `.subtitle`, `.hint` 텍스트 계층 정리
- `.upload-label` 채움 버튼 → 고스트/아웃라인 버튼 (accent 색상)
- `.workspace` 흰색 카드 → 다크 elevated 표면 + 테두리
- `.controls` 패널 다크 surface 적용
- `.btn-control` 통합: 파란/주황/초록 제거, 단일 accent 시스템
  - 토글 버튼(기록배경/기록글자): 고스트 기본, active시 accent 틴트
  - 저장 버튼: accent 채움 (주요 CTA)
- 커스텀 range 슬라이더 (WebKit + Firefox)
- `.canvas-container` 다크 테두리 + border-radius
- `.canvas-container canvas` 룰 추가 (인라인 스타일 대체)
- `.modal-overlay`, `.modal-content`, `.modal-close` 클래스 추가 (다크 모달)
- `.btn-download` 레거시 블록 제거
- 모바일 반응형 업데이트

### 2. src/index.css

- `@media (prefers-color-scheme: light)` 블록 제거 (다크 전용)
- `:root` 색상을 다크 기본값으로 변경
- 기본 `button` 스타일을 투명 배경 + 테두리로 변경

### 3. src/components/CanvasEditor.jsx

- 캔버스 인라인 스타일 축소 (cursor만 남기고 나머지 CSS로 이동)
- 프리뷰 모달: 인라인 `style={{}}` → `className` 기반으로 교체
  - `modal-overlay`, `modal-content`, `modal-close` 클래스 사용

### 4. index.html

- `theme-color` 메타 태그: `#ffffff` → `#1a1a1e`

### 5. vite.config.js

- PWA manifest `theme_color`: `#1a1a1e`

---

## 비포/애프터 요약

| 요소 | Before | After |
|------|--------|-------|
| 앱 배경 | 라이트 그레이 `#f0f2f5` | 다크 차콜 `#1a1a1e` |
| 워크스페이스 | 흰색 + 그림자 | 다크 `#232328` + 미세 테두리 |
| 컨트롤 패널 | 라이트 그레이 `#f5f5f5` | 다크 `#2a2a30` + 테두리 |
| 업로드 버튼 | 파란 채움 | 고스트 아웃라인 |
| 토글 버튼 | 파랑+주황 채움 | 고스트, active시 accent 틴트 |
| 저장 버튼 | 초록 채움 | 틸블루 accent `#5b9bd5` 채움 |
| 슬라이더 | 브라우저 기본 | 커스텀 다크 트랙 + accent 썸 |
| 모달 | 흰색 카드 | 다크 카드 + blur 오버레이 |
| 텍스트 | 어두운 글씨/밝은 배경 | 밝은 글씨/어두운 배경 |
| 테마 컬러 | `#ffffff` | `#1a1a1e` |

---

## 검증 방법

1. `npm run dev`로 개발 서버 실행
2. 브라우저에서 다크 테마 적용 확인
3. 배경/기록 이미지 업로드하여 캔버스 동작 확인
4. 기록배경/기록글자 토글 버튼 동작 확인
5. 슬라이더 조작 확인
6. 저장 버튼 → 프리뷰 모달 표시 확인
7. 모바일 뷰포트에서 반응형 확인
