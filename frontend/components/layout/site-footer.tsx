import { GithubLogoThemeAware } from "@/components/logos/github-theme-aware";
import { cn } from "@/lib/utils";

const footerGridPattern = cn(
	"screen-line-before screen-line-after flex w-full before:z-1 after:z-1",
	"bg-[repeating-linear-gradient(315deg,var(--pattern-foreground)_0,var(--pattern-foreground)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] [--pattern-foreground:var(--color-edge)]/56",
);

export function SiteFooter() {
	return (
		<footer className="max-w-screen overflow-x-hidden px-2">
			<div className="screen-line-before mx-auto border-x border-edge pt-4 min-w-6xl max-w-6xl">
				<p className="mb-4 px-4 text-center text-xs text-muted-foreground">
					Built during{" "}
					<a
						className="hover:text-foreground transition-colors"
						href="https://ethglobal.com"
						target="_blank"
						rel="noopener noreferrer"
					>
						ETHGlobal HackMoney
					</a>
				</p>

				<div className={footerGridPattern}>
					<div className="mx-auto flex items-center justify-center gap-3 border-x border-edge bg-background px-4">
						<a
							className="flex items-center transition-colors hover:opacity-80"
							href="https://github.com/Not-Sarthak/pintel"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub"
						>
							<GithubLogoThemeAware className="size-5" variant="invertocat" />
						</a>

						<Separator />

						<a
							className="flex items-center transition-colors hover:opacity-80 text-xs text-muted-foreground hover:text-foreground"
							href="https://x.com/0xSarthak13"
							target="_blank"
							rel="noopener noreferrer"
						>
							@0xSarthak13
						</a>
					</div>
				</div>
			</div>
			<div className="pb-[env(safe-area-inset-bottom,0px)]">
				<div className="flex h-2" />
			</div>
		</footer>
	);
}

function Separator() {
	return <div className="flex h-11 w-px bg-edge" />;
}
