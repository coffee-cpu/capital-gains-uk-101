export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-500">
          Educational and visualization tool, not financial or tax advice
        </div>
        <div className="mt-2 text-center text-sm text-gray-500">
          Found a problem or have feedback?{' '}
          <a
            href="https://github.com/coffee-cpu/capital-gains-uk-101/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Report an issue on GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
