"""Split combined legal text from transcript into four content files."""
import json
import os

TRANSCRIPT = r"C:\Users\Chester\.cursor\projects\c-Users-Chester-Documents-spe3d-projects-spe3d-lrp-sun-defender-rally\agent-transcripts\c5d9a690-47ec-491a-8949-64d8a5d81e46\c5d9a690-47ec-491a-8949-64d8a5d81e46.jsonl"
OUT_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "apps",
    "web",
    "src",
    "content",
)


def extract_user_text() -> str | None:
    with open(TRANSCRIPT, encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            if d.get("role") != "user":
                continue
            text = d.get("message", {}).get("content", [{}])[0].get("text", "")
            if "1. 認知與接受條款" not in text and "1. Acknowledgment" not in text:
                continue
            if "<user_query>" in text:
                text = text.split("<user_query>", 1)[1].split("</user_query>", 1)[0]
            text = text.strip()
            if text.startswith("隱私權政策的內容"):
                text = text.split(":", 1)[1].strip()
            if text.startswith("這是使用條款內容"):
                text = text.replace("這是使用條款內容，也請不要更改文字。", "", 1).strip()
            return text
    return None


def split_blocks(text: str) -> tuple[str, str]:
    marker = "\n\n1. 認知與接受條款"
    if marker in text:
        en, zh = text.split(marker, 1)
        return en.strip(), ("1. 認知與接受條款" + zh).strip()
    idx = text.find("1. 認知與接受條款")
    return text[:idx].strip(), text[idx:].strip()


def main() -> None:
    text = extract_user_text()
    if not text:
        raise SystemExit("No matching user message in transcript")

    en, zh = split_blocks(text)

    en_terms_marker = " Privacy policy The FunkAR (hereinafter"
    zh_terms_marker = " 最近一次更新條款：2024 年 10月 15 日 隱私權政策 啟雲科技股份有限公司"

    if en_terms_marker not in en:
        raise SystemExit(f"EN terms marker not found: {en_terms_marker!r}")
    if zh_terms_marker not in zh:
        raise SystemExit(f"ZH terms marker not found: {zh_terms_marker!r}")

    terms_en = en.split(en_terms_marker)[0].rstrip()
    privacy_en = "Privacy policy" + en.split(en_terms_marker, 1)[1]

    terms_zh = (
        zh.split(zh_terms_marker)[0].rstrip()
        + " 最近一次更新條款：2024 年 10月 15 日"
    )
    privacy_zh = "隱私權政策 啟雲科技股份有限公司" + zh.split(zh_terms_marker, 1)[1]

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, data in [
        ("terms-of-service-en.txt", terms_en),
        ("terms-of-service-zh.txt", terms_zh),
        ("privacy-policy-en.txt", privacy_en),
        ("privacy-policy-zh.txt", privacy_zh),
    ]:
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\n") as fo:
            fo.write(data)
        print(f"{name}: {len(data)} chars")


if __name__ == "__main__":
    main()
