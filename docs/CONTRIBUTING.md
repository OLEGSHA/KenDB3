# Contributing to KenDB3


## Report a problem

> **Responsible disclosure**
>
> If you believe you have found an exploitable security vulnerability, please reach out to OLEGSHA immediately:
> [Discord (@javapony)](https://discordapp.com/users/274586911094341632),
> [Telegram (@javapony)](https://t.me/javapony),
> [email &lt;kvadropups@gmail.com&gt;](mailto:kvadropups@gmail.com).

Please fill out an issue on [GitHub](https://github.com/OLEGSHA/KenDB3/issues).


## Make a suggestion

Please fill out an issue on [GitHub](https://github.com/OLEGSHA/KenDB3/issues) and label it an enhancement if you believe it suits KenDB goals and it should be easy enough to implement.


## Contribute code

Great! Fork the repository on GitHub and begin. Development setup should not take more than a minute; see [README](../README.md#developer-setup).

Take a look at [DEVELOPMENT.md](DEVELOPMENT.md), it has some onboarding and tips and tricks. There's decent high-level documentation in [docs](.), especially [ARCHITECTURE.md](ARCHITECTURE.md).

When you've got some commits, open a draft pull request on GitHub. We want to review and give corrections earlier rather then later.

If you want to implement a new feature that has not been discussed in issues yet, please open an issue or get in touch some other way first.


### Workflow

#### Repositories

- Main repository at [gitea.windcorp.ru](https://gitea.windcorp.ru/OLEGSHA/KenDB3): contains authoritative version of the code, runs CI/CD.
- Public-facing mirror at [github.com](https://github.com/OLEGSHA/KenDB3): contains issues and pull requests, meant for public use.

Gitea repository periodically force-pushes its branches into the GitHub repository.

#### Branches

- `main` branch contains the code deployed at `kendb.windcorp.ru`
- `development` branch contains the code deployed at `staging.kendb.windcorp.ru`
- feature branches host ongoing development efforts

#### Preferred pull request workflow

1. Contributor forks `development` branch on GitHub.
2. Contributor creates a pull request draft in GitHub to merge into `development`.
3. Issue is resolved or feature is implemented in contributor's fork; maintainers guide and review via PR draft.
4. Draft status is removed.
5. Some maintainer reviews the PR and merges it into `development`.
6. OLEGSHA reviews the pull request and its integration and merges it into `main`.


### Legal stuff

Unless you specify otherwise, it is assumed that you retain copyright for your changes, and that you license your changes to OLEGSHA under AGPL-v3-or-later license without further restrictions.
