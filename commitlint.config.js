const ATTRIBUTION_PATTERN = /(co-authored-by|signed-off-by|generated[- ]with|generated[- ]by|\bclaude\b|\banthropic\b)/i

export default {
	extends: ["@commitlint/config-conventional"],
	plugins: [
		{
			rules: {
				"no-attribution": (parsed) => {
					const hit = ATTRIBUTION_PATTERN.test(parsed.header || "")
					return [
						!hit,
						"commit message must not credit an AI tool (no Co-authored-by/Signed-off-by/Generated-with/Claude/Anthropic)",
					]
				},
			},
		},
	],
	rules: {
		"body-empty": [2, "always"],
		"footer-empty": [2, "always"],
		"no-attribution": [2, "always"],
	},
}
