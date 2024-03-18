import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { globby }   from 'globby'

export async function loadWorkspaceRegex() {
    const exists = new Set()

    try {
        const { workspaces } = await readFile(join(process.cwd(), '/package.json'), 'utf8').then(JSON.parse)

        if (workspaces?.length > 0) {
            const pkgs = await globby(
                workspaces.map((w) => (w.endsWith('/*') ? w + '*' : w)).map((w) => `${w}/package.json`),
                {
                    cwd: process.cwd(),
                    onlyFiles: true,
                    absolute: true,
                },
            )

            await Promise.all(
                pkgs.map(async (pkg) => {
                    try {
                        const { name } = await readFile(pkg, 'utf-8').then(JSON.parse)

                        exists.add(name)
                    } catch {
                        /* ignored */
                    }
                }),
            )
        }
    } catch {
        /* ignored */
    }

    return new RegExp(`^(${Array.from(exists).join('|')})(/.*)?\u0000?$`)
}
