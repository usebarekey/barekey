import { useParams } from "react-router-dom";

export function Page() {
  const { userId = "user" } = useParams();

  return <p>123 gogo</p>;
}

export default Page;
