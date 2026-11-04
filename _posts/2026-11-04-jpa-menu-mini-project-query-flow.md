---
layout: post
title: "JPA 메뉴 미니 프로젝트: 메뉴 조회, 가격 검색, 카테고리 조회를 Repository부터 예외 처리까지 채워 본 기록"
date: 2026-11-04 10:00:00 +0900
description: "TODO로 비어 있는 메뉴 관리 미니 프로젝트에서 메뉴 1건 조회, 가격 검색, 카테고리 조회 기능을 채웠다. JpaRepository 상속, 쿼리 메서드와 @Query native query, Optional.orElseThrow, Entity → DTO 변환, @ResponseBody와 fetch, @RequestParam 검증, @ControllerAdvice까지 정리했다. 검증 메시지가 엉뚱하게 나오던 문제와, SQL 에러가 빈 200 응답으로 숨던 문제도 같이 기록했다."
categories: [Exploration]
tags: [java, jpa, spring-boot, spring-data-jpa, dto, entity, validation, native-query]
mermaid: true
---

## 들어가며

JPA 수업의 미니 프로젝트는 메뉴 관리 웹 애플리케이션이다. 계층별 뼈대(Controller, Service, Repository, DTO, Entity, Policy, 예외 처리기)는 다 만들어져 있고, 실제 동작 코드는 `// TODO` 주석으로 비어 있다.

TODO 전체 중 지금까지 채운 건 아래 세 기능이다. 이 글은 이 세 기능만 다룬다.

| 기능 | URL | 채운 TODO |
|---|---|---|
| 메뉴 1건 조회 | `GET /menu/{menuCode}` | Controller 1, Service 0·1, `MenuDTO.from()`, `Menu` 엔티티 매핑, 예외 처리기 0·1 |
| 가격으로 메뉴 검색 | `GET /menu/search?menuPrice=...` | Controller 3, Service 3, `MenuRepository` 1·2, 예외 처리기 3 |
| 하위 카테고리 조회 (등록 화면용) | `GET /menu/category` | Controller 4, Service 4, `CategoryRepository` 1·2, `CategoryDTO.from()`, `Category` 엔티티 매핑 |

목록 조회, 등록, 수정, 삭제, 판매중지/재개, Policy 클래스들은 아직 비어 있다.

## 전체 흐름

메뉴 조회와 가격 검색은 요청이 지나가는 길이 같다. (카테고리 조회는 화면 대신 JSON을 돌려줘서 6번에서 따로 본다.)

```mermaid
flowchart LR
    B[브라우저] --> C[MenuController]
    C -->|menuCode / menuPrice| S[MenuService]
    S --> R[MenuRepository]
    R -->|Menu 엔티티| S
    S -->|MenuDTO 변환| C
    C -->|ModelAndView| V[Thymeleaf 화면]
    S -. BusinessException .-> H[GlobalExceptionHandler]
    C -. 검증 실패 .-> H
    H --> E[error/error 화면]
```

아래에서 DB에 가까운 쪽부터 위로 올라가면서 정리했다.

## 1. Entity: 테이블과 짝짓기

`Menu`는 `tbl_menu` 한 행과 매핑된다.

```java
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
@ToString
@Entity
@Table(name="tbl_menu")
public class Menu {

    @Id
    @Column(name = "menu_code")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int menuCode;

    @Column(name = "menu_name")
    private String menuName;

    @Column(name = "menu_price")
    private int menuPrice;

    @Column(name = "category_code")
    private int categoryCode;

    @Column(name = "orderable_status")
    private String orderableStatus;
}
```

- `menu_code`는 DB가 자동 증가시키는 PK라서 `IDENTITY` 전략을 썼다.
- 클래스에 setter가 없고, 전체 필드 생성자는 `private`이다. 이 프로젝트는 "Entity 값은 `create()`, `changeMenuName()`처럼 이름 있는 메서드로만 바꾼다"는 규칙으로 설계돼 있다. 그 메서드들은 아직 TODO로 남아 있다.

## 2. Repository: 인터페이스만 만들면 구현은 Spring Data JPA가

```java
@Repository
public interface MenuRepository extends JpaRepository<Menu, Integer> {

    List<Menu> findByMenuPriceGreaterThanOrderByMenuPrice(int menuPriceIsGreaterThan);
}
```

`JpaRepository<관리할 엔티티, @Id 필드 타입>`을 상속하는 것만으로 `findById()`, `findAll()`, `save()`, `deleteById()` 같은 메서드를 바로 쓸 수 있다. 구현 클래스는 내가 만들지 않는다. 실행할 때 Spring Data JPA가 프록시 구현체를 만들어 Bean으로 등록한다.

지난번 회원 예제에서는 Repository를 클래스로 만들고 `EntityManager`를 직접 주입받아 `persist()`를 불렀다. 이번에는 그 코드가 통째로 사라졌다.

| | 지난 예제 (`MemberRepository`) | 이번 (`MenuRepository`) |
|---|---|---|
| 형태 | 클래스 | 인터페이스 |
| EntityManager | `@PersistenceContext`로 직접 주입 | 안 보임 (구현체 안에 있음) |
| 저장 / 조회 | `manager.persist()` 직접 호출 | 상속받은 `save()`, `findById()` |

### 쿼리 메서드: 메서드 이름이 곧 조건

가격 검색은 상속받은 기본 메서드로는 안 돼서 **쿼리 메서드**를 하나 선언했다. 이름을 규칙대로 지으면 Spring Data JPA가 이름을 쪼개서 JPQL을 만든다.

```text
findBy  MenuPrice  GreaterThan  OrderBy  MenuPrice
  │        │           │           │        │
 조회    필드명    조건( > )      정렬    정렬 기준(기본 오름차순)
```

여기서 헷갈리기 쉬운 게 하나 있다. 코드 주석에는 "menuPrice **이상**"이라고 적혀 있는데, `GreaterThan`은 **초과(`>`)** 다. 이상(`>=`)을 원하면 `GreaterThanEqual`을 써야 한다. 프로젝트 README의 요구사항은 "입력 가격 **초과**"라서 지금 메서드 이름이 맞고, 주석 쪽이 부정확하다.

| 키워드 | 조건 |
|---|---|
| `GreaterThan` | `price > ?` (초과) |
| `GreaterThanEqual` | `price >= ?` (이상) |

조건이 한두 개일 때는 메서드 이름만으로 끝나서 편하다. 대신 조건이 늘거나 조인이 필요해지면 이름이 너무 길어져서 읽기 어려워진다. 그때는 `@Query`로 직접 쿼리를 쓰는 편이 낫다. 카테고리 조회에서 실제로 `@Query`를 썼는데, 6번에서 다룬다.

## 3. Service: 조회 → 없으면 예외 → DTO 변환

```java
@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuRepository menuRepository;

    public MenuDTO findMenuByMenuCode(int menuCode) {
        Menu foundMenu = menuRepository.findById(menuCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.MENU_NOT_FOUND));

        return MenuDTO.from(foundMenu);
    }

    public List<MenuDTO> findMenuByPrice(int menuPrice) {
        List<Menu> menuList = menuRepository.findByMenuPriceGreaterThanOrderByMenuPrice(menuPrice);

        return menuList.stream()
                .map(menu -> MenuDTO.from(menu))
                .toList();
    }
}
```

### 의존성 주입: `@RequiredArgsConstructor`

`menuRepository`는 `final`인데 생성자가 코드에 안 보인다. Lombok의 `@RequiredArgsConstructor`가 `final` 필드를 받는 생성자를 만들어 주고, 생성자가 하나뿐이면 Spring이 그 생성자로 Bean을 주입한다. 필드에 `@Autowired`를 붙이지 않아도 된다.

### `findById()`는 왜 `Optional`을 돌려줄까

`findById()`의 반환 타입은 `Menu`가 아니라 `Optional<Menu>`다. 해당 menuCode가 DB에 없을 수도 있다는 걸 타입으로 드러낸 것이다. 만약 `Menu`를 그냥 돌려줬다면 없을 때 `null`이 오고, 그걸 모르고 쓰다가 엉뚱한 곳에서 `NullPointerException`이 났을 것이다.

`orElseThrow()`로 "없으면 이 예외를 던져라"를 조회하는 자리에서 바로 정했다. 예외는 `ErrorCode.MENU_NOT_FOUND`를 담은 `BusinessException`이다. 이 예외를 받아서 화면을 보여주는 건 Service가 아니라 아래에서 볼 `GlobalExceptionHandler`다.

### Entity는 Service 밖으로 나가지 않는다

Service는 Controller에게 `Menu`가 아니라 `MenuDTO`를 돌려준다. 변환 메서드는 DTO 쪽에 있다.

```java
public static MenuDTO from(Menu menu) {
    return new MenuDTO(
            menu.getMenuCode(),
            menu.getMenuName(),
            menu.getMenuPrice(),
            menu.getCategoryCode(),
            menu.getOrderableStatus()
    );
}
```

변환 메서드를 Entity가 아니라 DTO에 둔 이유는 의존 방향 때문이다. DTO는 Entity를 알아도 되지만, Entity는 화면용 객체인 DTO를 몰라야 한다. 그래야 화면이 바뀌어도 Entity는 건드리지 않는다.

여러 건을 변환할 때는 `for`문 대신 `stream().map().toList()`를 썼다. "리스트의 각 원소를 이렇게 바꿔라"를 한 줄로 쓸 수 있다. `menu -> MenuDTO.from(menu)`는 메서드 참조 `MenuDTO::from`으로 줄일 수도 있다. (주석에 남겨 둔 `MenuDTO::from(menu)`는 괄호가 붙어서 문법 오류다. 메서드 참조에는 인자를 쓰지 않는다.)

## 4. Controller: 값 꺼내기, 검증 선언, 화면 고르기

```java
@GetMapping("/{menuCode}")
public ModelAndView findByMenuByPathVariable(@PathVariable int menuCode, ModelAndView mv) {
    MenuDTO findMenu = menuService.findMenuByMenuCode(menuCode);
    mv.addObject("result", findMenu);
    mv.setViewName("menu/detail");
    return mv;
}

@GetMapping("/search")
public ModelAndView findByMenuPrice(@RequestParam
                                    @Min(value = 0, message = "가격은 0 이상 입력!")
                                    int menuPrice,
                                    ModelAndView mv) {
    List<MenuDTO> menuList = menuService.findMenuByPrice(menuPrice);
    mv.addObject("menuList", menuList);
    mv.addObject("price", menuPrice);
    mv.setViewName("menu/searchResult");
    return mv;
}
```

### `@PathVariable` vs `@RequestParam`

| | 요청 예 | 꺼내는 방법 | 주로 쓰는 경우 |
|---|---|---|---|
| Path Variable | `/menu/3` | `@PathVariable` | 특정 자원 하나를 가리킬 때 |
| Query String | `/menu/search?menuPrice=1000` | `@RequestParam` | 검색 조건, 필터 |

URL에 `?`가 있느냐로 구분하면 쉽다.

### 검증은 백엔드에서도 한다

가격 입력란에 JS로 음수를 막아도, 사용자가 주소창에 `?menuPrice=-100`을 직접 치면 그대로 서버에 온다. 그래서 `@RequestParam`에 `@Min(0)`을 붙였다.

Controller는 검증을 **선언만** 하고, 실패했을 때의 처리(try-catch)는 쓰지 않는다. 이 프로젝트에서 Controller는 정상 흐름만 담당한다.

## 5. GlobalExceptionHandler: 예외를 한 곳에서 화면으로

```java
@Slf4j
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ModelAndView handleBusinessException(BusinessException e) {
        return errorPage(e.getErrorCode().getStatus(), e.getMessage());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ModelAndView handleMethodValidation(HandlerMethodValidationException e) {
        String message = e.getAllErrors().get(0).getDefaultMessage();
        return errorPage(HttpStatus.BAD_REQUEST, message);
    }

    // errorPage(): error/error 화면에 상태코드와 메시지를 담는 제공 코드
}
```

`@ControllerAdvice`를 붙이면 모든 Controller에서 던져진 예외가 여기로 모이고, `@ExceptionHandler`에 적은 예외 타입에 맞는 메서드가 호출된다.

두 예외가 각각 어디서 출발하는지 정리하면 이렇다.

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant C as MenuController
    participant S as MenuService
    participant H as GlobalExceptionHandler

    B->>C: GET /menu/9999
    C->>S: findMenuByMenuCode(9999)
    S-->>H: BusinessException(MENU_NOT_FOUND)
    H-->>B: error/error (ErrorCode의 상태코드)

    B->>C: GET /menu/search?menuPrice=-100
    Note over C: @Min(0) 검증 실패 (메서드 실행 전)
    C-->>H: HandlerMethodValidationException
    H-->>B: error/error (400)
```

- `BusinessException`은 Service가 직접 던진다. 상태코드와 메시지는 `ErrorCode`에 같이 들어 있어서, 처리기는 꺼내 쓰기만 한다.
- `HandlerMethodValidationException`은 Controller 메서드가 **실행되기 전에** Spring이 파라미터 검증을 하다가 던진다. Spring Framework 6.1부터는 Controller 클래스에 `@Validated`가 없어도, 메서드 파라미터에 `@Min` 같은 제약 어노테이션이 붙어 있으면 이 내장 검증이 동작한다.

덕분에 Service에도 Controller에도 try-catch가 하나도 없다.

### 검증 메시지가 엉뚱하게 나온 문제

처음에는 `@RequestParam` 검증 실패를 이렇게 처리했다.

```java
// 수정 전
String message = e.getMessage();
```

`/menu/search?menuPrice=-1`로 요청해 보니 에러 화면에 내가 `@Min`에 적은 문구가 아니라 이게 떴다.

```text
400
😥 400 BAD_REQUEST "Validation failure"
```

`HandlerMethodValidationException`은 `ResponseStatusException`을 상속한다. 그래서 `getMessage()`는 "상태코드 + 이유" 형태의 Spring 기본 문구를 돌려준다. `@Min(message = "가격은 0 이상 입력!")`에 적은 문구는 예외 자체의 메시지가 아니다. 예외 안에 담긴 **검증 에러 목록**의 각 항목에 들어 있다.

```java
// 수정 후
String message = e.getAllErrors().get(0).getDefaultMessage();
```

`getAllErrors()`가 검증에 실패한 항목들을 돌려주고, 그중 첫 번째의 `getDefaultMessage()`가 어노테이션에 적은 문구다. 같은 요청을 다시 보내니 의도한 문구가 나왔다.

| | 꺼낸 값 | 화면에 나온 메시지 |
|---|---|---|
| 수정 전 | `e.getMessage()` | `400 BAD_REQUEST "Validation failure"` |
| 수정 후 | `e.getAllErrors().get(0).getDefaultMessage()` | `가격은 0 이상 입력!` |

## 6. 카테고리 조회: 화면이 아니라 데이터를 돌려주기

메뉴 등록 화면에는 카테고리를 고르는 `<select>`가 있다. 여기에 들어갈 하위 카테고리 목록을 서버에서 받아 온다.

### `@ResponseBody`가 필요한 이유

지금까지 Controller의 마지막 일은 View를 돌려주는 거였다. 그런데 메인 화면 하나에서 메뉴 목록, 주문 목록, 회원 목록을 다 보여줘야 한다면? 화면마다 각자 Controller에서 같은 데이터를 다시 조회해서 Model에 담아야 한다. 다른 사람이 이미 만든 조회 결과를 화면마다 반복해서 다시 작성하게 된다.

`@ResponseBody`를 붙이면 Controller가 View 이름 대신 **데이터 자체**를 응답한다. 화면을 그리는 책임은 빠지고, 필요한 화면이 데이터를 가져다 쓰기만 하면 된다.

```java
@GetMapping("/category")
@ResponseBody
public List<CategoryDTO> findCategoryList() {
    return menuService.findSubCategories();
}
```

`List<CategoryDTO>`를 그대로 돌려주면 Spring이 Jackson으로 JSON 배열로 바꿔 준다. 이때 Jackson은 **getter**를 보고 필드를 읽기 때문에 `CategoryDTO`에 `@Getter`가 있어야 한다.

실제 응답은 이렇게 나왔다.

```json
[
  {"categoryCode":4,"categoryName":"한식","refCategoryCode":1},
  {"categoryCode":5,"categoryName":"중식","refCategoryCode":1},
  ...
  {"categoryCode":12,"categoryName":"서양","refCategoryCode":3}
]
```

### 화면 쪽: `fetch`로 받아서 `<option>` 만들기

`regist.html`은 페이지가 열릴 때 `fetch`로 이 URL을 따로 호출한다.

```javascript
fetch('/menu/category')
    .then(res => res.json())          // 응답 문자열(JSON) -> JS 객체 배열
    .then(data => {
        const $categoryCode = document.getElementById("categoryCode");

        for (let index in data) {
            const $option = document.createElement("option");
            $option.value = data[index].categoryCode;
            $option.textContent = data[index].categoryName;
            $categoryCode.appendChild($option);
        }
    });
```

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant C as MenuController
    participant S as MenuService
    participant R as CategoryRepository

    B->>C: GET /menu/regist
    C-->>B: regist.html (select는 비어 있음)
    Note over B: 페이지가 열리면 fetch 실행 (비동기)
    B->>C: GET /menu/category
    C->>S: findSubCategories()
    S->>R: findSubCategory()
    R-->>S: List<Category>
    S-->>C: List<CategoryDTO>
    C-->>B: JSON 배열
    Note over B: JSON → option 태그로 select 채움
```

비동기라서, 사용자가 버튼을 누르는 등 따로 뭘 하지 않아도 페이지가 열리면 백그라운드에서 요청이 나가고, 응답이 오면 `then` 안의 코드가 실행된다.

### Category 엔티티: `refCategoryCode`는 왜 `Integer`일까

```java
@Entity
@Table(name="tbl_category")
public class Category {

    @Id
    @Column(name = "category_code")
    private int categoryCode;

    @Column(name = "category_name")
    private String categoryName;

    @Column(name = "ref_category_code")
    private Integer refCategoryCode;    // 최상위 카테고리는 NULL
}
```

`tbl_category`는 자기 자신을 참조하는 구조다. 한식(4)의 상위는 식사(1)이고, 식사처럼 맨 위에 있는 카테고리는 `ref_category_code`가 `NULL`이다. 기본형 `int`는 `null`을 담을 수 없다. 그래서 `null`이 들어올 수 있는 컬럼은 래퍼 타입 `Integer`로 받는다.

`tbl_category`의 `category_code`도 DB에서는 AUTO_INCREMENT다. 그래도 `@GeneratedValue`를 붙이지 않았다. 이 프로젝트에서 `Category`는 조회 전용이라 JPA로 INSERT할 일이 없기 때문이다. 나중에 카테고리 등록 기능이 생기면 `Menu`처럼 `IDENTITY` 전략을 붙여야 한다.

### `@Query`: JPQL과 native query

"하위 카테고리만, category_code 순으로"는 쿼리 메서드로도 쓸 수는 있다. 그래도 이번 과제는 `@Query`로 쿼리를 직접 써 보는 게 목적이었다.

```java
@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {

    @Query(value = "select * from tbl_category m where ref_category_code is not null order by category_code",
           nativeQuery = true)
    List<Category> findSubCategory();
}
```

`@Query`에는 두 종류가 있다.

| | JPQL | Native Query |
|---|---|---|
| 대상 | **엔티티와 필드** (`Category`, `refCategoryCode`) | **실제 테이블과 컬럼** (`tbl_category`, `ref_category_code`) |
| 문법 | JPA 표준, DB 종류와 무관 | 사용하는 DB(MySQL)의 SQL 그대로 |
| 설정 | 기본값 | `nativeQuery = true` |

`nativeQuery = true`를 빼먹으면 Spring Data JPA는 이 문자열을 JPQL로 해석한다. JPQL에는 `tbl_category`라는 엔티티가 없으니 실행 전에 에러가 난다.

Service는 받은 엔티티 목록을 DTO로 바꿔서 돌려준다. 이번에는 람다 대신 메서드 참조를 썼다.

```java
public List<CategoryDTO> findSubCategories() {
    List<Category> categoryList = categoryRepository.findSubCategory();
    return categoryList.stream()
            .map(CategoryDTO::from)
            .toList();
}
```

### 쿼리가 잘렸는데 에러 화면이 안 뜬 문제

처음 작성한 쿼리는 끝이 잘려 있었다.

```sql
-- 수정 전
... where ref_category_code is not null order by ca
```

`/menu/category`를 호출하니 이상한 응답이 왔다. 에러 화면도 아니고 JSON도 아니고, **상태코드 200에 본문이 비어 있었다.**

```text
HTTP/1.1 200
Content-Length: 0
```

브라우저 쪽만 보면 "그냥 카테고리가 하나도 없나?"로 보인다. 그런데 서버 콘솔에는 에러가 찍혀 있었다.

```text
SQL Error: 1054, SQLState: 42S22
Unknown column 'ca' in 'order clause'
Resolved [org.springframework.dao.InvalidDataAccessResourceUsageException: ...]
```

`ca`라는 컬럼이 없어서 SQL이 실패한 거였다. native query는 문자열 그대로 DB에 가기 때문에, 오타가 있어도 애플리케이션 시작 때는 아무도 검사하지 않는다. **호출하는 순간** MySQL이 거부하고 나서야 드러난다.

그럼 왜 500 에러 화면이 아니라 빈 200이었을까. 이 예외는 `GlobalExceptionHandler`의 맨 마지막 `handleException(Exception e)`가 받는다. 그런데 그 메서드는 아직 TODO 7이라 `return null`인 상태였다.

```mermaid
flowchart LR
    A[SQL 실패] --> B[InvalidDataAccessResourceUsageException]
    B --> C["handleException()<br/>(TODO 7: return null)"]
    C --> D["'처리 완료'로 간주"]
    D --> E[200 + 빈 본문]
```

`@ExceptionHandler` 메서드가 `null`을 돌려주면 Spring은 "예외 처리가 끝났다"고 보고 따로 화면을 그리지 않는다. 그래서 예외가 처리된 것처럼 보이면서 빈 응답이 나갔다. 아직 안 채운 TODO 하나가 다른 기능의 에러를 숨기고 있던 셈이다.

TODO 스펙대로 정렬 기준을 `category_code`로 고치고 다시 호출하니 하위 카테고리 9개가 순서대로 나왔다.

```sql
-- 수정 후
... where ref_category_code is not null order by category_code
```

## 정리

- `Menu` 엔티티에 `@Entity`, `@Table`, `@Id`, `@GeneratedValue(IDENTITY)`, `@Column`으로 테이블을 매핑했다.
- `JpaRepository`를 상속하면 기본 CRUD 구현은 Spring Data JPA가 만들어 준다. 직접 다루던 `EntityManager`가 코드에서 사라졌다.
- 쿼리 메서드는 이름이 곧 조건이다. `GreaterThan`은 초과, `GreaterThanEqual`은 이상이다.
- `findById()`는 `Optional`을 돌려주고, `orElseThrow()`로 "없을 때"를 조회 자리에서 바로 처리했다.
- Service는 Entity를 DTO로 바꿔서 돌려주고, 변환 메서드는 DTO 쪽에 둔다.
- Controller는 검증을 선언만 하고, 예외는 `@ControllerAdvice` 한 곳에서 화면으로 바꾼다.
- `@RequestParam` 검증 실패 메시지는 `getMessage()`가 아니라 `getAllErrors()`의 항목에서 꺼내야 한다.
- `@ResponseBody`는 View 대신 데이터를 응답한다. DTO는 getter를 통해 JSON이 된다.
- `@Query`는 기본이 JPQL이고, `nativeQuery = true`일 때만 실제 SQL을 쓴다. native query의 오타는 호출해야 드러난다.
- `@ExceptionHandler`가 `null`을 돌려주면 에러가 빈 200 응답으로 숨는다. 브라우저 응답만 보지 말고 서버 로그를 같이 봐야 한다.

남은 TODO는 목록 조회(`Sort.by`), 등록/수정/삭제(`@Transactional`, 변경 감지), 나머지 예외 처리기(특히 TODO 7), 그리고 PART 3의 Policy 클래스들이다.

## 더 학습하면 좋은 개념

- **`Sort`와 `Pageable`**: 다음 TODO인 전체 목록 조회에서 `findAll(Sort.by(...))`를 쓴다. 메뉴가 많아지면 `Pageable`로 페이지 단위 조회까지 이어진다.
- **`@RestController`**: 클래스 전체에 `@ResponseBody`를 적용한 것과 같다. 데이터만 응답하는 API 서버를 만들 때 기본으로 쓴다.
- **JPQL 문법**: 이번엔 native query를 썼지만, JPQL로 쓰면 DB가 바뀌어도 쿼리를 고칠 필요가 없고, 엔티티 이름이 틀리면 애플리케이션 시작 시점에 검증된다.
- **변경 감지(Dirty Checking)**: 메뉴 이름 수정 TODO는 `save()` 없이 엔티티 값만 바꾸고 트랜잭션이 끝날 때 UPDATE가 나가는 구조다.
- **`MethodArgumentNotValidException`과 `BindException`**: 메뉴 등록 시 `@Valid` DTO 검증이 실패하면 `@RequestParam` 검증과는 다른 예외가 온다. 둘의 차이를 알아야 예외 처리기 TODO 2를 채울 수 있다.

## 참고 자료

- [Spring Data JPA - Query Methods](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)
- [Spring Data JPA - Repository query keywords](https://docs.spring.io/spring-data/jpa/reference/repositories/query-keywords-reference.html)
- [Spring Framework - Method Validation (Web MVC)](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html)
- [Spring Framework - Controller Advice](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-advice.html)
- [Spring Framework - Exceptions (@ExceptionHandler 반환값)](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html)
- [Spring Framework - @ResponseBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/responsebody.html)
- [Spring Data JPA - Using @Query](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html#jpa.query-methods.at-query)
- [Java SE 17 - Optional](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Optional.html)
