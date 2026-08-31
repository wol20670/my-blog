---
name: note
description: 배운 것을 학습 노트로 정리해서 블로그에 올린다. /note 라고 하면 실행한다.
---

# 학습 노트 만들기

아래 순서대로 해줘.

1. 내 요청에서 이 글의 성격(Troubleshooting/Exploration)과 글감이 될 내용을 먼저 판단해.
   - "겪은 문제/막힘/에러/해결"류 표현 → Troubleshooting.
   - "배우다가 흥미로운 점/더 발전시켜서/생각을 확장"류 표현 → Exploration.
   - 내가 이미 문제-원인-해결(또는 개념-흥미로운 점-발전 방향) 같은 핵심 내용을 충분히 줬으면
     "뭘 배웠어요?" 같은 걸 다시 묻지 말고 바로 글 작성으로 넘어가.
   - 성격만 애매하면 성격만 물어봐. 내용이 부족하면 부족한 부분만 구체적으로 물어봐(이미 답한 건
     다시 묻지 마). 둘 다 애매하면 성격부터 확인해.
2. 내용을 가지고 `_posts/` 에 글을 만들어줘.
   - 파일 이름과 Front Matter의 일반 형식(layout/title/date 등)은 `CLAUDE.md` 규칙을 따라.
   - 글 유형 판별, `categories` 값, 권장 구조, `tags` 정책은 `BLOG_POLICY.md`를 따라(source of truth).
   - `categories`는 결정된 성격에 따라 `[Troubleshooting]` 또는 `[Exploration]` 중 하나만 써.
   - 본문 구조는 `BLOG_POLICY.md`의 해당 성격 권장 구조(Troubleshooting §1, Exploration §1)를
     참고하되 기계적으로 강제하지는 마.
   - `tags`는 `_posts/` 기존 글들의 tag 표기(소문자, 하이픈 등)를 참고하되, 실제로 어떤 tag를 붙일지는
     이 글의 본문 내용만 근거로 판단해. `troubleshooting`/`exploration`은 category와 의미가 겹치니
     tag로 넣지 마.
3. 다 쓰면 나에게 먼저 보여줘. 내가 좋다고 하기 전에는 커밋하지 마.
4. 내가 확인하면 커밋하고 push 해줘.