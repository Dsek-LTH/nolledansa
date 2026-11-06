import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-5 text-sm text-gray-500">
        Har du problem? Kontakta Vincent Lindell på Messenger eller via mail{" "}
        <a
          href="mailto:vincentlindell1@gmail.com"
          className="font-medium text-brand-700 hover:underline"
        >
          vincentlindell1@gmail.com
        </a>
        .
      </div>

      <div className="relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative grid grid-cols-1 gap-8 border-t border-gray-200 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.15fr_0.9fr] lg:gap-6 lg:py-12">
            <a
              href="https://www.dsek.se/home"
              className="flex w-fit items-center gap-2.5 self-start text-base font-semibold text-gray-800 hover:text-brand-600 lg:self-center"
            >
              <Image src="/dsek-logo.svg" width={28} height={28} alt="" />
              D-sektionen inom TLTH
            </a>

            <address className="text-sm not-italic leading-relaxed text-gray-500">
              D-sektionen inom TLTH<br />
              Box 118<br />
              221 00 Lund
            </address>

            <address className="text-sm not-italic leading-relaxed text-gray-500">
              iDét, E-husets källare<br />
              Kommunikationsvägen 2A<br />
              223 63 Lund
            </address>

            <p className="text-sm leading-relaxed text-gray-500">
              Organisationsnummer<br />
              845003-2878
            </p>

          </div>
        </div>
      </div>
    </footer>
  );
}
