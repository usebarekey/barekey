import * as UserProfile from "@/pages/u/user/profile/page";
import * as UserSecurity from "@/pages/u/user/security/page";

export function Page() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <section id="profile" className="scroll-mt-24">
        <UserProfile.Page />
      </section>

      <section id="security" className="scroll-mt-24">
        <UserSecurity.Page />
      </section>
    </div>
  );
}
