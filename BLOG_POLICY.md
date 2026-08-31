# BLOG_POLICY.md — 블로그 운영 정책 (Category/Tag/글 유형)

이 문서는 이 블로그를 실제로 운영하면서 적용하는 **category/tag 및 글 유형 정책**을 정의한다.

- 일반적인 글쓰기 품질, 기술적 정확성, Markdown 작성 원칙 등은 `CLAUDE.md`(부트캠프 멘토님이 제공한
  일반 가이드)를 따른다. `CLAUDE.md`는 원문 그대로 두고 여기서 재작성하지 않는다.
- 이 블로그의 **글 유형, category, tags, 구조 적용 방식**은 이 문서(`BLOG_POLICY.md`)를 따른다.
- 두 문서의 내용이 서로 다르게 읽힐 경우, **글 유형/category/tag 등 taxonomy에 관한 사항은 이
  문서가 `CLAUDE.md`보다 우선**한다. (예: `CLAUDE.md`의 STAR "Action 60% 이상"/"정량 지표 필수"
  같은 형식적 강제 조건은 이 블로그에서는 적용하지 않는다 — 아래 참고.)
- `.claude/skills/*`는 이 정책과 `CLAUDE.md`를 실제 작업 절차로 적용하는 역할을 한다.

---

## 1. 글 유형

이 블로그에는 성격이 다른 두 종류의 글이 있다.

### Troubleshooting

개발이나 학습 과정에서 실제 문제를 겪고 해결해나가는 과정이 중심인 글.

권장 흐름:

```
문제 상황 → 초기 가설 → 확인/시도 → 결과 → 실제 원인 → 해결 → 더 나은 방법/예방 → 배운 점
```

- 이 흐름은 권장 구조이지, 모든 heading을 기계적으로 강제하는 템플릿은 아니다.
- `CLAUDE.md`의 STAR 개념은 참고할 수 있지만, 다음 두 조건은 이 블로그에서 강제하지 않는다.
  - Action이 반드시 글의 60% 이상이어야 한다.
  - Result에 반드시 정량 지표가 있어야 한다.
- 실제 정량 결과가 있다면 쓰되, 없는 수치를 만들어내지 않는다.
- 실패한 시도도 기록한다 — 실패 과정이 독자에게 가장 큰 가치를 준다.

### Exploration

새로운 기술이나 개념을 배우다가 흥미로운 지점을 발견하고, 단순 개념 정리에서 끝나지 않고 생각을
더 확장하는 글.

권장 흐름:

```
새로운 개념 → 흥미로운 지점 → 핵심 원리 → 기존 지식과 연결 → 활용/발전 방향
```

- 이 역시 모든 heading을 기계적으로 강제하지 않는다.

---

## 2. Category

Category는 기술명이 아니라 **글의 성격/목적**을 나타낸다.

허용되는 값은 정확히 다음 둘 중 하나다.

- `Troubleshooting`
- `Exploration`

Front Matter 예:

```yaml
categories: [Troubleshooting]
```

```yaml
categories: [Exploration]
```

- 게시글 하나에는 category를 **정확히 하나만** 사용한다.
- `Git`, `GitHub`, `JavaScript`, `React` 등 기술명을 category로 사용하지 않는다 — 기술명은 tags로 관리한다.
- category 값은 이 사이트의 post permalink(`/posts/:title/`)에 관여하지 않으므로, category를 바꿔도
  게시글 URL은 바뀌지 않는다.

---

## 3. Tags

Tags는 글에서 실제로 다루는 **기술, 개념, 세부 주제**를 나타낸다.

```yaml
categories: [Troubleshooting]
tags: [git, merge, conflict]
```

```yaml
categories: [Exploration]
tags: [git, branch, workflow]
```

원칙:

- 대상 글의 실제 내용을 근거로 tag를 선택한다 (다른 글에 있다는 이유만으로 추가하지 않는다).
- 기존 `_posts/`의 tag vocabulary를 우선 재사용한다.
- 동일한 의미의 tag 표기가 중복되지 않도록 한다.
- 대소문자와 하이픈 표기는 기존 블로그 관례(소문자, 하이픈)를 따른다.
- 새로운 tag는 실제로 필요한 글을 쓸 때만 추가한다 — 미리 대규모 tag 목록을 만들지 않는다.
- `troubleshooting`, `exploration`은 category와 의미가 중복되므로 tag로 넣지 않는다.

---

## 4. "더 학습하면 좋은 개념" 섹션

`CLAUDE.md`에는 이 섹션이 필수 규칙으로 존재하지만, 이 블로그 운영에서는 고정 heading으로 강제하지 않는다.

- Troubleshooting 글에서는 필요하면 후속 학습/예방 방향으로 포함할 수 있다.
- Exploration 글에서는 "활용/발전 방향" 단계와 자연스럽게 이어지는 것을 권장한다.
- 내용상 필요하지 않다면 억지로 추가하지 않는다.
- 반드시 `"더 학습하면 좋은 개념"`이라는 heading 이름을 그대로 쓸 필요는 없다.
