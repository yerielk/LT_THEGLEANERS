import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingBlock: "64px 120px" }}>
      <h1 className="display">Not in the archive.</h1>
      <p className="lede">찾는 작품이나 전시가 없어요. 주소를 확인하거나 Discover에서 다시 찾아보세요.</p>
      <Link className="btn" href="/discover">Go to Discover</Link>
    </div>
  );
}
