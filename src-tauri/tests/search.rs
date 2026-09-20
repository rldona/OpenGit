mod support;

use opengit_lib::git::{grep_worktree, log_page, GrepQuery, GrepResult, LogSearch, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn commit_as(repo: &TestRepo, author: &str, email: &str, file: &str, content: &str, message: &str) {
    repo.write(file, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&[
        "commit",
        "-q",
        &format!("--author={author} <{email}>"),
        "-m",
        message,
    ]);
}

fn search(grep: Option<&str>, author: Option<&str>, path: Option<&str>) -> LogSearch {
    LogSearch {
        grep: grep.map(str::to_string),
        author: author.map(str::to_string),
        path: path.map(str::to_string),
        follow: false,
    }
}

fn subjects(repo: &TestRepo, filter: &LogSearch) -> Vec<String> {
    log_page(&runner(), repo.path(), 0, 100, None, Some(filter))
        .expect("log filtrado")
        .into_iter()
        .map(|commit| commit.subject)
        .collect()
}

#[test]
fn searches_by_message_literally_and_ignoring_case() {
    let repo = TestRepo::init();
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "a.txt",
        "uno\n",
        "feat: a.b",
    );
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "a.txt",
        "dos\n",
        "feat: axb",
    );

    let literal = subjects(&repo, &search(Some("a.b"), None, None));
    assert_eq!(literal, vec!["feat: a.b"]);

    let upper = subjects(&repo, &search(Some("A.B"), None, None));
    assert_eq!(upper, vec!["feat: a.b"]);
}

#[test]
fn searches_by_author_name_or_email() {
    let repo = TestRepo::init();
    commit_as(
        &repo,
        "Ana López",
        "ana@example.com",
        "a.txt",
        "uno\n",
        "commit de ana",
    );
    commit_as(
        &repo,
        "OpenGit Test",
        "test@opengit.dev",
        "a.txt",
        "dos\n",
        "commit de test",
    );

    assert_eq!(
        subjects(&repo, &search(None, Some("ana"), None)),
        vec!["commit de ana"]
    );
    assert_eq!(
        subjects(&repo, &search(None, Some("test@opengit.dev"), None)),
        vec!["commit de test"]
    );
}

#[test]
fn searches_by_file_and_combines_filters() {
    let repo = TestRepo::init();
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "f1.txt",
        "uno\n",
        "toca f1",
    );
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "f2.txt",
        "uno\n",
        "toca f2",
    );
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "f2.txt",
        "dos\n",
        "otra vez f2",
    );

    assert_eq!(
        subjects(&repo, &search(None, None, Some("f2.txt"))),
        vec!["otra vez f2", "toca f2"]
    );

    let combined = subjects(&repo, &search(Some("toca"), None, Some("f2.txt")));
    assert_eq!(combined, vec!["toca f2"]);
}

#[test]
fn paginates_filtered_results() {
    let repo = TestRepo::init();
    for index in 0..5 {
        commit_as(
            &repo,
            "Ana",
            "ana@example.com",
            "a.txt",
            &format!("{index}\n"),
            &format!("tema {index}"),
        );
    }

    let filter = search(Some("tema"), None, None);
    let first = log_page(&runner(), repo.path(), 0, 2, None, Some(&filter)).unwrap();
    let second = log_page(&runner(), repo.path(), 2, 2, None, Some(&filter)).unwrap();
    let third = log_page(&runner(), repo.path(), 4, 2, None, Some(&filter)).unwrap();

    assert_eq!(first.len(), 2);
    assert_eq!(second.len(), 2);
    assert_eq!(third.len(), 1);
}

#[test]
fn empty_search_does_not_filter() {
    let repo = TestRepo::init();
    commit_as(&repo, "Ana", "ana@example.com", "a.txt", "uno\n", "uno");
    commit_as(&repo, "Ana", "ana@example.com", "a.txt", "dos\n", "dos");

    assert!(search(None, None, None).is_empty());
    assert!(search(Some("  "), None, None).is_empty());
    assert_eq!(subjects(&repo, &search(None, None, None)).len(), 2);
}

#[test]
fn follows_a_file_across_renames() {
    let repo = TestRepo::init();
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "old.txt",
        "uno\n",
        "crea old",
    );
    repo.git_ok(&["mv", "old.txt", "new.txt"]);
    repo.git_ok(&["commit", "-q", "-m", "renombra"]);
    commit_as(
        &repo,
        "Ana",
        "ana@example.com",
        "new.txt",
        "dos\n",
        "edita new",
    );

    // Without `--follow` the rename breaks the trail: only the new name counts.
    assert_eq!(
        subjects(&repo, &search(None, None, Some("new.txt"))),
        vec!["edita new", "renombra"]
    );

    let mut filter = search(None, None, Some("new.txt"));
    filter.follow = true;
    assert_eq!(
        subjects(&repo, &filter),
        vec!["edita new", "renombra", "crea old"]
    );
}

fn grep(repo: &TestRepo, pattern: &str, overrides: impl FnOnce(&mut GrepQuery)) -> GrepResult {
    let mut query = GrepQuery {
        pattern: pattern.to_string(),
        case_sensitive: true,
        whole_word: false,
        regex: false,
        path: None,
        max_results: None,
    };
    overrides(&mut query);
    grep_worktree(&runner(), repo.path(), &query).expect("grep")
}

#[test]
fn grep_worktree_finds_matches_and_honours_the_options() {
    let repo = TestRepo::init();
    repo.write("src/a.txt", b"hello world\nHello World\n");
    repo.write("src/b.txt", b"nothing here\n");
    repo.git_ok(&["add", "."]);

    let sensitive = grep(&repo, "hello", |_| {});
    assert_eq!(sensitive.matches.len(), 1);
    assert_eq!(sensitive.matches[0].path, "src/a.txt");
    assert_eq!(sensitive.matches[0].line, 1);
    assert_eq!(sensitive.matches[0].text, "hello world");

    let insensitive = grep(&repo, "hello", |query| query.case_sensitive = false);
    assert_eq!(insensitive.matches.len(), 2);

    let whole_word = grep(&repo, "hell", |query| query.whole_word = true);
    assert!(whole_word.matches.is_empty());

    let filtered = grep(&repo, "hello", |query| {
        query.path = Some("src/b.txt".into())
    });
    assert!(filtered.matches.is_empty());

    let capped = grep(&repo, "hello", |query| {
        query.case_sensitive = false;
        query.max_results = Some(1);
    });
    assert_eq!(capped.matches.len(), 1);
    assert!(capped.truncated);
}
