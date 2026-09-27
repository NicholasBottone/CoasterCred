import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page-content py-12 text-center">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        This page may have moved or the link may be incorrect.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center rounded px-3 font-medium text-primary hover:underline"
      >
        Go to Feed
      </Link>
    </div>
  );
}
